# TREE Token Website

Canonical source for the redeployed original TREE Token website.

## Production

- Hosting: Netlify
- Production branch: `main`
- Publish directory: repository root (`.`)
- Build step: none; this is a static HTML/CSS/JavaScript site
- Server-side market-data proxy: `netlify/functions/tree-market.ts`

## Required Netlify environment variables

Create these in **Netlify → Site configuration → Environment variables**:

- `NOODLES_API_KEY`
- `NOODLES_API_URL`

Use `.env.example` only as a list of required variable names. Never commit a populated `.env` file.

The API key present in the source archive must be treated as exposed and rotated before production use.

## Local preview

The static page can be previewed with any local web server. To exercise the Netlify Function and environment variables, use Netlify Dev from the repository root.

## Important launch validation

Before publishing the custom domain:

1. Test the homepage at desktop and mobile widths.
2. Confirm the Noodles market widget loads through `/api/tree-market`.
3. Confirm `assets/CG.png` and `Litepaper.pdf` load on the case-sensitive Netlify filesystem.
4. Test NFTree mint and Garden Battles links.
5. Test wallet connection with a non-custodial test wallet.
6. Validate the embedded SuiDex transaction with a very small amount before exposing it broadly.
7. Confirm all package, router, factory, pool, token, and clock object IDs against current mainnet state.

## Archive cleanup applied

- Excluded `node_modules/`
- Removed the populated `.env`
- Removed the Noodles API key from browser-delivered source
- Added a Netlify Function for authenticated market-data requests
- Fixed case-sensitive asset links
- Removed requests for three parallax files absent from the archive
- Updated NFTree links from the old Netlify subdomain to `nftree.net`
- Corrected whole-number quote conversion used by the swap minimum-output calculation
- Removed the nonfunctional swap-direction flip from the buy-only modal
