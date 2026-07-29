export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  internalDate?: string;
  isUnread?: boolean;
}

export interface GmailMessageDetail extends GmailMessageSummary {
  bodyText?: string;
  bodyHtml?: string;
  labels?: string[];
}

function decodeBase64Url(str: string): string {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return decodeURIComponent(
      Array.from(atob(base64))
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch (e) {
    try {
      return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    } catch (err) {
      return str;
    }
  }
}

function extractBodyFromPayload(payload: any): { text: string; html: string } {
  let text = '';
  let html = '';

  if (!payload) return { text, html };

  if (payload.body && payload.body.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/html') {
      html = decoded;
    } else {
      text = decoded;
    }
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const partBody = extractBodyFromPayload(part);
      if (partBody.text) text += (text ? '\n' : '') + partBody.text;
      if (partBody.html) html += (html ? '<br>' : '') + partBody.html;
    }
  }

  return { text, html };
}

export async function listGmailMessages(
  token: string,
  query: string = '',
  maxResults: number = 20
): Promise<GmailMessageSummary[]> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  if (query) url.searchParams.append('q', query);
  url.searchParams.append('maxResults', String(maxResults));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro na API do Gmail (${res.status})`);
  }

  const data = await res.json();
  if (!data.messages || !Array.isArray(data.messages)) {
    return [];
  }

  // Fetch summaries for each message in parallel
  const details = await Promise.all(
    data.messages.slice(0, maxResults).map(async (msg: { id: string }) => {
      try {
        const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`;
        const detailRes = await fetch(detailUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!detailRes.ok) return null;
        const detailData = await detailRes.json();
        const headers: GmailHeader[] = detailData.payload?.headers || [];

        const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '(Sem assunto)';
        const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || 'Desconhecido';
        const to = headers.find((h) => h.name.toLowerCase() === 'to')?.value || '';
        const date = headers.find((h) => h.name.toLowerCase() === 'date')?.value || '';
        const isUnread = (detailData.labelIds || []).includes('UNREAD');

        return {
          id: detailData.id,
          threadId: detailData.threadId,
          snippet: detailData.snippet,
          subject,
          from,
          to,
          date,
          internalDate: detailData.internalDate,
          isUnread,
        };
      } catch (e) {
        return null;
      }
    })
  );

  return details.filter((d): d is GmailMessageSummary => d !== null);
}

export async function getGmailMessageDetail(token: string, messageId: string): Promise<GmailMessageDetail> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Erro ao buscar detalhes da mensagem (${res.status})`);
  }

  const data = await res.json();
  const headers: GmailHeader[] = data.payload?.headers || [];

  const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '(Sem assunto)';
  const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || 'Desconhecido';
  const to = headers.find((h) => h.name.toLowerCase() === 'to')?.value || '';
  const date = headers.find((h) => h.name.toLowerCase() === 'date')?.value || '';
  const isUnread = (data.labelIds || []).includes('UNREAD');

  const { text, html } = extractBodyFromPayload(data.payload);

  return {
    id: data.id,
    threadId: data.threadId,
    snippet: data.snippet,
    subject,
    from,
    to,
    date,
    internalDate: data.internalDate,
    isUnread,
    bodyText: text,
    bodyHtml: html,
    labels: data.labelIds || [],
  };
}

export async function sendGmailMessage(
  token: string,
  to: string,
  subject: string,
  bodyText: string
): Promise<{ id: string; threadId: string }> {
  // Construct raw MIME message
  const utf8Subject = `=?utf-8?B?${btoa(
    Array.from(new TextEncoder().encode(subject))
      .map((b) => String.fromCharCode(b))
      .join('')
  )}?=`;

  const emailLines = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    bodyText.replace(/\n/g, '<br>'),
  ];

  const rawEmail = emailLines.join('\r\n');

  // Base64Url encode raw email
  const base64Encoded = btoa(
    Array.from(new TextEncoder().encode(rawEmail))
      .map((b) => String.fromCharCode(b))
      .join('')
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: base64Encoded,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao enviar e-mail via Gmail API (${res.status})`);
  }

  return await res.json();
}
