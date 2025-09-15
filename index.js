/* index.js - Looker Studio Community Visualization entry */
const dscc = window.dscc;

/**
 * Minimal UI helper
 */
function setStatus(msg) {
  const el = document.getElementById('json-exporter-status');
  if (el) el.textContent = msg;
}

/**
 * Build HMAC-SHA256 hex signature with Web Crypto
 */
async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Serialize current table into a row object (expecting single-row pages)
 */
function currentRow(data) {
  const fields = (data.fields.dimensions || []).concat(data.fields.metrics || []).map(f => f.name);
  const rows = (data.tables.DEFAULT || []).map(r => {
    const o = {};
    r.forEach((cell, i) => { o[fields[i]] = (cell && cell.v != null) ? String(cell.v) : ''; });
    return o;
  });
  return rows[0] || {};
}

/**
 * The draw callback runs whenever data/filters/style change.
 */
async function draw(data) {
  // Basic container
  if (!document.getElementById('json-exporter-status')) {
    const div = document.createElement('div');
    div.id = 'json-exporter-status';
    div.style.cssText = 'font:12px Arial; color:#888;';
    document.body.appendChild(div);
  }

  const style = data.style || {};
  const ingestUrl = style.ingestUrl || '';       // set in Style
  const sharedSecret = style.sharedSecret || ''; // set in Style
  const reportId = style.reportId || '';         // set in Style

  if (!ingestUrl || !sharedSecret) {
    setStatus('Configure ingestUrl & sharedSecret in Style');
    return;
  }

  const row = currentRow(data);
  const tool = row['Tools'] || row['Tool'] || row['Connector'] || row['Name'] || '';
  const payload = {
    report_id: reportId,
    page_id: data.themeId || '',
    tool,
    fields: row
  };

  try {
    const body = JSON.stringify(payload);
    const sig = await hmacHex(sharedSecret, body);
    await fetch(ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': sig
      },
      body
    });
    setStatus('Exported snapshot');
  } catch (e) {
    setStatus('Export failed (check URL/secret)');
  }
}

/**
 * Subscribe to Looker Studio data updates
 */
dscc.subscribeToData(draw, { transform: dscc.transform });
