import net from 'node:net'
import { spawn } from 'node:child_process'

const deterministicCiPort = 4287

const reserveFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not allocate a Playwright web-server port.'))
        return
      }
      const { port } = address
      server.close((error) => (error ? reject(error) : resolve(port)))
    })
  })

const port = process.env.PLAYWRIGHT_PORT
  ? Number(process.env.PLAYWRIGHT_PORT)
  : process.env.CI
    ? deterministicCiPort
    : await reserveFreePort()

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid PLAYWRIGHT_PORT: ${String(process.env.PLAYWRIGHT_PORT)}`)
}

const child = spawn(process.execPath, ['./node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: { ...process.env, PLAYWRIGHT_PORT: String(port) },
  stdio: 'inherit',
})

child.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exitCode = code ?? 1
})
