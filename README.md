# `fracworker`

A Cloudflare Worker for generating mandlebrot fractals.

## Parameters

The following query parameters change how the fractal is generated:

- `i=`: iterations to run per pixel
- `z=`: zoom level
- `zx=`: x coordinate to zoom into
- `zy=`: y coordinate to zoom into
- `ss=`: how much supersampling to do (calculates `ss^2` more pixels)
