/**
 * Envio de vídeo em partes (chunked upload) para o video-server.
 *
 * Por quê: o domínio video.maisresultadosonline.com.br passa pelo proxy da
 * Cloudflare, que recusa qualquer requisição acima de 100MB (HTTP 413) antes
 * de chegar ao Nginx/Express. Arquivos grandes travavam em "Enviando… 0%".
 * Aqui o navegador envia partes pequenas (< 100MB), com nova tentativa por
 * parte, e o servidor junta tudo e chama o MESMO transcoding HLS já existente.
 *
 * Rotas:
 *   POST /api/video/chunk/init                 { filename, size, total_chunks }
 *   GET  /api/video/chunk/:id/status           -> { received: number[] }
 *   PUT  /api/video/chunk/:id/:index           corpo binário da parte
 *   POST /api/video/chunk/:id/complete         -> mesma resposta de /api/video/upload
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_TOTAL = 5 * 1024 * 1024 * 1024; // 5GB
const MAX_CHUNK = 95 * 1024 * 1024; // abaixo do limite de 100MB da Cloudflare
const MAX_CHUNKS = 2000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const log = (...args) => console.log('[chunk-upload]', new Date().toISOString(), ...args);

module.exports = function registerChunkUpload(app, deps) {
  const { UPLOAD_ROOT, HLS_ROOT, sanitizeBaseName, writeJob, publicHlsUrl, startTranscoding } = deps || {};
  const missing = Object.entries({ UPLOAD_ROOT, HLS_ROOT, sanitizeBaseName, writeJob, publicHlsUrl, startTranscoding })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    log('DESATIVADO — dependências ausentes no server.js:', missing.join(', '));
    return;
  }

  const CHUNK_ROOT = path.join(UPLOAD_ROOT, 'chunks');
  fs.mkdirSync(CHUNK_ROOT, { recursive: true });

  const isValidId = (id) => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);
  const sessionDir = (id) => path.join(CHUNK_ROOT, id);
  const metaFile = (id) => path.join(sessionDir(id), 'meta.json');
  const readMeta = (id) => {
    try { return JSON.parse(fs.readFileSync(metaFile(id), 'utf8')); } catch { return null; }
  };
  const receivedChunks = (id) => {
    try {
      return fs.readdirSync(sessionDir(id))
        .filter((f) => /^\d+\.part$/.test(f))
        .map((f) => Number(f.split('.')[0]))
        .sort((a, b) => a - b);
    } catch { return []; }
  };

  // Limpeza de sessões abandonadas (a cada hora).
  const cleanup = () => {
    try {
      for (const id of fs.readdirSync(CHUNK_ROOT)) {
        const dir = sessionDir(id);
        const stat = fs.statSync(dir);
        if (Date.now() - stat.mtimeMs > SESSION_TTL_MS) {
          fs.rmSync(dir, { recursive: true, force: true });
          log('sessão expirada removida', id);
        }
      }
    } catch (e) { log('erro na limpeza', e.message); }
  };
  setInterval(cleanup, 60 * 60 * 1000).unref();

  app.get('/api/video/chunk/health', (_req, res) => res.json({ success: true, chunked: true, max_chunk: MAX_CHUNK }));

  app.post('/api/video/chunk/init', (req, res) => {
    const { filename, size, total_chunks } = req.body || {};
    const sizeNum = Number(size);
    const totalNum = Number(total_chunks);
    if (typeof filename !== 'string' || !filename.trim() || filename.length > 300) {
      return res.status(400).json({ success: false, error: 'Nome de arquivo inválido' });
    }
    if (!Number.isFinite(sizeNum) || sizeNum <= 0 || sizeNum > MAX_TOTAL) {
      return res.status(400).json({ success: false, error: 'Tamanho inválido (máx 5GB)' });
    }
    if (!Number.isInteger(totalNum) || totalNum < 1 || totalNum > MAX_CHUNKS) {
      return res.status(400).json({ success: false, error: 'Quantidade de partes inválida' });
    }
    const id = crypto.randomBytes(16).toString('hex');
    fs.mkdirSync(sessionDir(id), { recursive: true });
    fs.writeFileSync(metaFile(id), JSON.stringify({ filename, size: sizeNum, total_chunks: totalNum, created_at: Date.now() }));
    log('init', id, filename, (sizeNum / 1048576).toFixed(1) + 'MB', totalNum + ' partes');
    res.json({ success: true, upload_id: id, max_chunk: MAX_CHUNK });
  });

  app.get('/api/video/chunk/:id/status', (req, res) => {
    const { id } = req.params;
    if (!isValidId(id) || !readMeta(id)) return res.status(404).json({ success: false, error: 'Envio não encontrado' });
    res.json({ success: true, received: receivedChunks(id) });
  });

  app.put('/api/video/chunk/:id/:index', (req, res) => {
    const { id } = req.params;
    const index = Number(req.params.index);
    const meta = isValidId(id) ? readMeta(id) : null;
    if (!meta) return res.status(404).json({ success: false, error: 'Envio não encontrado' });
    if (!Number.isInteger(index) || index < 0 || index >= meta.total_chunks) {
      return res.status(400).json({ success: false, error: 'Índice inválido' });
    }
    const finalPath = path.join(sessionDir(id), index + '.part');
    const tmpPath = finalPath + '.tmp-' + process.pid + '-' + Date.now();
    const out = fs.createWriteStream(tmpPath);
    let bytes = 0;
    let aborted = false;

    const fail = (status, msg) => {
      if (aborted) return;
      aborted = true;
      out.destroy();
      fs.rm(tmpPath, { force: true }, () => {});
      if (!res.headersSent) res.status(status).json({ success: false, error: msg });
    };

    req.on('data', (buf) => {
      bytes += buf.length;
      if (bytes > MAX_CHUNK) { fail(413, 'Parte grande demais'); req.destroy(); }
    });
    req.on('aborted', () => fail(400, 'Envio da parte interrompido'));
    out.on('error', (e) => fail(500, 'Falha ao gravar: ' + e.message));
    out.on('finish', () => {
      if (aborted) return;
      if (bytes === 0) return fail(400, 'Parte vazia');
      fs.rename(tmpPath, finalPath, (err) => {
        if (err) return fail(500, 'Falha ao salvar parte');
        res.json({ success: true, index, bytes });
      });
    });
    req.pipe(out);
  });

  app.post('/api/video/chunk/:id/complete', async (req, res) => {
    const { id } = req.params;
    const meta = isValidId(id) ? readMeta(id) : null;
    if (!meta) return res.status(404).json({ success: false, error: 'Envio não encontrado' });

    const got = receivedChunks(id);
    if (got.length !== meta.total_chunks) {
      const missingIdx = [];
      for (let i = 0; i < meta.total_chunks && missingIdx.length < 20; i++) if (!got.includes(i)) missingIdx.push(i);
      return res.status(409).json({ success: false, error: 'Faltam partes', missing: missingIdx });
    }

    const parsed = path.parse(meta.filename);
    const ext = (parsed.ext || '.mp4').replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10) || '.mp4';
    const assembledPath = path.join(UPLOAD_ROOT, Date.now() + '-' + sanitizeBaseName(parsed.name) + ext);

    try {
      await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(assembledPath);
        out.on('error', reject);
        let i = 0;
        const next = () => {
          if (i >= meta.total_chunks) { out.end(resolve); return; }
          const src = fs.createReadStream(path.join(sessionDir(id), i + '.part'));
          src.on('error', reject);
          src.on('end', () => { i++; next(); });
          src.pipe(out, { end: false });
        };
        next();
      });

      const finalSize = fs.statSync(assembledPath).size;
      if (finalSize !== meta.size) {
        fs.rmSync(assembledPath, { force: true });
        return res.status(422).json({ success: false, error: `Tamanho final diferente (${finalSize} de ${meta.size})` });
      }
    } catch (e) {
      fs.rmSync(assembledPath, { force: true });
      log('erro ao juntar', id, e.message);
      return res.status(500).json({ success: false, error: 'Falha ao juntar as partes' });
    }

    fs.rm(sessionDir(id), { recursive: true, force: true }, () => {});

    // Mesmo fluxo do POST /api/video/upload original.
    const fileName = Date.now() + '-' + sanitizeBaseName(parsed.name);
    const outputDir = path.join(HLS_ROOT, fileName);
    fs.mkdirSync(outputDir, { recursive: true });
    writeJob(fileName, { status: 'queued', progress: 0 });
    log('completo', id, '->', fileName, (meta.size / 1048576).toFixed(1) + 'MB');

    res.json({ success: true, job_id: fileName, video_url: '', hls_url: publicHlsUrl(fileName) });
    setImmediate(() => startTranscoding(fileName, assembledPath, outputDir));
  });

  log('rotas de envio em partes ativas');
};
