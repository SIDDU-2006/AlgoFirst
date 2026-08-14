const net = require('net');
const { spawn } = require('child_process');
const nextBin = require.resolve('next/dist/bin/next');

const START_PORT = 4028;
const MAX_PORT_ATTEMPTS = 20;

function isPortFree(port) {
  return new Promise((resolve) => {
    const checkHost = (host) =>
      new Promise((hostResolve) => {
        const socket = net.createConnection({ port, host });
        const finish = (result) => {
          socket.destroy();
          hostResolve(result);
        };

        socket.setTimeout(200);
        socket.once('connect', () => finish(false));
        socket.once('timeout', () => finish(true));
        socket.once('error', () => finish(true));
      });

    Promise.all([checkHost('127.0.0.1'), checkHost('::1')]).then((results) => {
      resolve(results.every(Boolean));
    });
  });
}

async function main() {
  let port = START_PORT;

  while (port < START_PORT + MAX_PORT_ATTEMPTS) {
    if (await isPortFree(port)) {
      break;
    }

    port += 1;
  }

  if (port >= START_PORT + MAX_PORT_ATTEMPTS) {
    throw new Error(`No free port found between ${START_PORT} and ${START_PORT + MAX_PORT_ATTEMPTS - 1}.`);
  }

  const child = spawn(process.execPath, [nextBin, 'dev', '-p', String(port)], {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      PORT: String(port),
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.exit(1);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
