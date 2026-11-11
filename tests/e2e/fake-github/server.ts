/**
 * A stand-in for api.github.com in E2E runs (docs/04 §3.2): serves recorded PR responses.
 *   node tests/e2e/fake-github/server.ts --port 3200
 *
 * PR numbers choose the answer: 404 → not found, 401 → bad token, anything else → a PR
 * whose state follows the number (even → merged, multiple of 5 → closed, otherwise open).
 */
import { createServer } from 'node:http';
import { badCredentials, closedPull, mergedPull, notFound, openPull } from '#src/server/github/fixtures/recorded.ts';

const portIndex = process.argv.indexOf('--port');
const port = Number(process.argv[portIndex + 1] ?? '3200');
const pullPath = /^\/repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)$/;

const server = createServer((request, response) => {
  const match = pullPath.exec(request.url ?? '');
  const send = (status: number, body: unknown): void => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  if (request.url === '/health') {
    send(200, { ok: true });
    return;
  }
  if (match === null) {
    send(404, notFound);
    return;
  }
  const number = Number(match[3]);
  if (number === 404) {
    send(404, notFound);
    return;
  }
  if (number === 401) {
    send(401, badCredentials);
    return;
  }
  const base = number % 5 === 0 ? closedPull : number % 2 === 0 ? mergedPull : openPull;
  send(200, { ...base, number, title: `${base.title} (#${String(number)})` });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`fake GitHub listening on ${String(port)}`);
});
