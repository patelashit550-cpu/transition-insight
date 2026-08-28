import "server-only"

import {
  CANONICAL_SITE_URL,
  CORPUS_BTC_ADDRESS,
  CORPUS_ENS_DOMAIN,
  CORPUS_ETH_ADDRESS,
  CORPUS_SOLANA_ADDRESS,
  SNS_DOMAIN,
  SOL_SITE_URL,
} from "./public-identity"

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
  return base ? `https://${base}.sol.site` : null
}

export function getSovereignIdentity(): SovereignIdentity {
  const solana = process.env.NEXT_PUBLIC_SOLANA_WALLET_ADDRESS?.trim() || CORPUS_SOLANA_ADDRESS
  const sns = process.env.NEXT_PUBLIC_SNS_DOMAIN?.trim() || SNS_DOMAIN

  return {
    did: solana ? `did:pkh:solana:${solana}` : null,
    addresses: {
      solana,
      eth: process.env.NEXT_PUBLIC_ETH_WALLET_ADDRESS?.trim() || CORPUS_ETH_ADDRESS,
      btc: process.env.NEXT_PUBLIC_BTC_WALLET_ADDRESS?.trim() || CORPUS_BTC_ADDRESS,
    },
    staking: {
      validator: process.env.NEXT_PUBLIC_VALIDATOR_NAME || null,
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
      web: process.env.NEXT_PUBLIC_SITE_URL?.trim() || CANONICAL_SITE_URL,
      sns,
      solSite: deriveSolSiteUrl(sns) || SOL_SITE_URL,
      ens: process.env.NEXT_PUBLIC_ENS_DOMAIN?.trim() || CORPUS_ENS_DOMAIN,
    },
  }
}

