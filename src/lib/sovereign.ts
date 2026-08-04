import "server-only"

export interface SovereignIdentity {
  readonly did: string | null
  readonly addresses: {
    readonly solana: string | null
    readonly eth: string | null
    readonly btc: string | null
  }
  readonly staking: {
    readonly validator: string | null
    readonly validatorVoteAccount: string | null
  }
  readonly ipfs: {
    readonly peerId: string | null
    readonly cid: string | null
    readonly directory: string | null
  }
  readonly domains: {
    readonly web: string
    readonly sns: string | null
    readonly solSite: string | null
    readonly ens: string | null
  }
}

function deriveSolSiteUrl(sns: string | null): string | null {
  const explicit = process.env.NEXT_PUBLIC_SOL_SITE_URL?.trim()
  if (explicit) return explicit
  if (!sns) return null
  const base = sns.replace(/\.sol$/i, '')
  return base ? `https://${base}.sol.sites` : null
}

export function getSovereignIdentity(): SovereignIdentity {
  const solana = process.env.NEXT_PUBLIC_SOLANA_WALLET_ADDRESS || null
  const sns = process.env.NEXT_PUBLIC_SNS_DOMAIN || null

  return {
    did: solana ? `did:pkh:solana:${solana}` : null,
    addresses: {
      solana,
      eth: process.env.NEXT_PUBLIC_ETH_WALLET_ADDRESS || null,
      btc: process.env.NEXT_PUBLIC_BTC_WALLET_ADDRESS || null,
    },
    staking: {
      validator: process.env.NEXT_PUBLIC_VALIDATOR_NAME || 'Lumos Maxima',
      validatorVoteAccount: process.env.NEXT_PUBLIC_VALIDATOR_VOTE_ACCOUNT || null,
    },
    ipfs: {
      peerId: process.env.IPFS_PEER_ID || null,
      cid: process.env.NEXT_PUBLIC_IPFS_CID || null,
      directory: process.env.NEXT_PUBLIC_IPFS_CID
        ? `${(process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud').replace(/\/$/, '')}/ipfs/${process.env.NEXT_PUBLIC_IPFS_CID}/`
        : null,
    },
    domains: {
      web: process.env.NEXT_PUBLIC_SITE_URL || 'https://ashitmilne.xyz',
      sns,
      solSite: deriveSolSiteUrl(sns),
      ens: process.env.NEXT_PUBLIC_ENS_DOMAIN || null,
    },
  }
}

