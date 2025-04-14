import path from "node:path"

// Used as an optimization to avoid dual lookups for missing assets
const assetExtensionRegExp = /\.(html?|png|jpg|js|css|svg|gif|ico|woff|woff2)$/

export const getFilePathsForURL = (pathname: string, baseDirectory = "") => {
  const urlVariations = getURLVariations(pathname)
  const possiblePaths = urlVariations.map(urlVariation => {
    const parts = urlVariation.split("/").filter(Boolean) as string[]

    return path.resolve.apply(null, [baseDirectory, ...parts])
  })

  return possiblePaths
}

export const getURLVariations = (pathname: string) => {
  const paths: string[] = []
  
  if (pathname[pathname.length - 1] === '/') {
    const end = pathname.length - 1

    if (pathname !== '/') {
      paths.push(`${pathname.slice(0, end)}.html`, `${pathname.slice(0, end)}.htm`)
    }

    paths.push(`${pathname}index.html`, `${pathname}index.htm`)
  } else if (!assetExtensionRegExp.test(pathname)) {
    paths.push(`${pathname}.html`, `${pathname}.htm`, `${pathname}/index.html`, `${pathname}/index.htm`)
  }

  if (!(paths.includes(pathname))) {
    return [pathname, ...paths]
  }

  return paths
}