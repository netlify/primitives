export default async function handler() {
  return new Response(`Hello from ${process.env.DEPLOY_URL}`)
}

export const config = {
  path: '/hello',
}
