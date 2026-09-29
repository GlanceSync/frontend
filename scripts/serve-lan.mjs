#!/usr/bin/env node
/**
 * Starts the dev server on every network interface.
 *
 * Angular's dev server refuses requests whose Host header it does not recognise
 * (an SSRF guard), and the allow-list has no wildcard. Hardcoding an address would
 * break the moment the machine gets a different one, so the list is built from the
 * interfaces the machine actually has, each time it starts.
 *
 * Extra names — a tunnel hostname, an mDNS name — can be added without editing this:
 *   EXTRA_HOSTS=myapp.ngrok-free.app,my-box.local npm run start:lan
 *
 * SSL=1 serves https with a self-signed certificate. That matters for calls: browsers
 * only expose the microphone and camera in a secure context, which means https or
 * localhost, so over a plain http LAN address a call can never start.
 */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const interfaces = Object.entries(networkInterfaces())
  .flatMap(([name, entries]) =>
    (entries ?? [])
      .filter(details => details.family === 'IPv4')
      .map(details => ({ name, address: details.address }))
  );

const localAddresses = interfaces.map(entry => entry.address);

const extraHosts = (process.env.EXTRA_HOSTS ?? '')
  .split(',')
  .map(host => host.trim())
  .filter(Boolean);

const allowedHosts = [...new Set(['localhost', ...localAddresses, ...extraHosts])];

// Docker bridges and the loopback are real interfaces but never how another machine
// reaches this one, so they are not worth printing as somewhere to browse to.
const isNoise = name => name === 'lo' || name.startsWith('br-') || name.startsWith('docker') || name.startsWith('veth');
const reachable = interfaces.filter(entry => !isNoise(entry.name));

const port = process.env.PORT ?? '4200';
const useSsl = process.env.SSL === '1' || process.env.SSL === 'true';
const scheme = useSsl ? 'https' : 'http';

console.log('\nGlanceSync dev server — reachable at:');
console.log(`  ${scheme}://localhost:${port}`);
for (const { name, address } of reachable) {
  console.log(`  ${scheme}://${address}:${port}`.padEnd(34) + `(${name})`);
}
if (useSsl) {
  console.log(
    '\nThe certificate is self-signed, so each browser shows a warning once.' +
    '\nAccept it ("Advanced" then "Proceed") and calls will work from any of these addresses.\n'
  );
} else {
  console.log(
    '\nNote: microphone and camera only work on localhost or https, so calls will not' +
    '\nstart over a plain http:// LAN address. Use SSL=1 npm run start:lan for those.\n'
  );
}

const args = [
  'serve',
  '--host', '0.0.0.0',
  '--port', port,
  ...(useSsl ? ['--ssl'] : []),
  ...allowedHosts.flatMap(host => ['--allowed-hosts', host])
];

const child = spawn('ng', args, { stdio: 'inherit', shell: true });
child.on('exit', code => process.exit(code ?? 0));
