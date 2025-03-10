import { SiteNavigationItem, Profile } from "~/lib/types"
import { nanoid } from "nanoid"
import unidata from "~/queries/unidata.server"
import { toGateway } from "~/lib/ipfs-parser"
import type Unidata from "unidata.js"
import type { Profiles as UniProfiles } from "unidata.js"
import { createClient } from "@urql/core"
import axios from "axios"
import { indexer } from "@crossbell/indexer"
import type { LinkEntity, NoteEntity, Contract } from "crossbell.js"
import { CharacterOperatorPermission } from "crossbell.js"
import { GeneralAccount } from "@crossbell/connect-kit"

export const checkSubdomain = async ({
  subdomain,
  updatingSiteId,
}: {
  subdomain: string
  updatingSiteId?: string
}) => {}

const expandSite = (site: Profile) => {
  site.navigation = JSON.parse(
    site.metadata?.raw?.attributes?.find(
      (a: any) => a.trait_type === "xlog_navigation",
    )?.value || "null",
  ) ||
    site.metadata?.raw?.["_xlog_navigation"] ||
    site.metadata?.raw?.["_crosslog_navigation"] || [
      { id: nanoid(), label: "Archives", url: "/archives" },
    ]
  site.css =
    site.metadata?.raw?.attributes?.find(
      (a: any) => a.trait_type === "xlog_css",
    )?.value ||
    site.metadata?.raw?.["_xlog_css"] ||
    site.metadata?.raw?.["_crosslog_css"] ||
    ""
  site.ga =
    site.metadata?.raw?.attributes?.find((a: any) => a.trait_type === "xlog_ga")
      ?.value || ""
  site.custom_domain =
    site.metadata?.raw?.attributes?.find(
      (a: any) => a.trait_type === "xlog_custom_domain",
    )?.value || ""
  site.name = site.name || site.username
  site.description = site.bio

  if (site.avatars) {
    site.avatars = site.avatars.map((avatar) => toGateway(avatar))
  }
  if (site.banners) {
    site.banners.map((banner) => {
      banner.address = toGateway(banner.address)
      return banner
    })
  }
  delete site.metadata?.raw

  return site
}

export type GetUserSitesParams =
  | {
      address: string
      unidata?: Unidata
    }
  | {
      handle: string
      unidata?: Unidata
    }

export const getUserSites = async (params: GetUserSitesParams) => {
  let profiles: UniProfiles | null = null

  try {
    const source = "Crossbell Profile"
    const filter = { primary: true }

    if ("address" in params) {
      profiles = await (params.unidata || unidata).profiles.get({
        source,
        filter,
        identity: params.address,
        platform: "Ethereum",
      })
    }

    if ("handle" in params) {
      profiles = await (params.unidata || unidata).profiles.get({
        source,
        filter,
        identity: params.handle,
        platform: "Crossbell",
      })
    }
  } catch (error) {
    return null
  }

  const sites: Profile[] =
    profiles?.list?.map((profile) => {
      expandSite(profile)
      return profile
    }) ?? []

  return sites.length > 0 ? sites : null
}

export type GetAccountSitesParams = {
  account: GeneralAccount
  unidata?: Unidata
}

export const getAccountSites = (
  params: GetAccountSitesParams,
): Promise<Profile[] | null> => {
  switch (params.account.type) {
    case "email":
      return getUserSites({
        handle: params.account.character.handle,
        unidata: params.unidata,
      })
    case "wallet":
      return getUserSites({
        address: params.account.address,
        unidata: params.unidata,
      })
  }
}

export const getSite = async (input: string, customUnidata?: Unidata) => {
  const profiles = await (customUnidata || unidata).profiles.get({
    source: "Crossbell Profile",
    identity: input,
    platform: "Crossbell",
  })

  const site: Profile = profiles.list[0]
  if (site) {
    expandSite(site)
  }

  return site
}

export const getSites = async (input: string[]) => {
  const client = createClient({
    url: "https://indexer.crossbell.io/v1/graphql",
  })
  const result = await client
    .query(
      `
        query getCharacters($identities: [String!], $limit: Int) {
          characters( where: { handle: { in: $identities } }, orderBy: [{ updatedAt: desc }], take: $limit ) {
            handle
            updatedAt
            characterId
            notes {
              updatedAt
            }
            metadata {
              uri
              content
            }
          }
        }`,
      {
        identities: input,
      },
    )
    .toPromise()

  await Promise.all(
    result.data?.characters?.map(async (site: any) => {
      if (!site?.metadata?.content && site?.metadata?.uri) {
        try {
          site.metadata.content = (
            await axios.get(toGateway(site?.metadata?.uri), {
              ...(typeof window === "undefined" && {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
                },
              }),
            })
          ).data
        } catch (error) {
          console.warn(error)
        }
      }
      if (site.metadata.content) {
        site.metadata.content.name = site.metadata?.content?.name || site.handle
      } else {
        site.metadata.content = {
          name: site.handle,
        }
      }

      site.custom_domain =
        site.metadata?.content?.attributes?.find(
          (a: any) => a.trait_type === "xlog_custom_domain",
        )?.value || ""

      site.updatedAt = [...site.notes, site]
        .map((i) => i.updatedAt)
        .sort()
        .pop()
    }),
  )

  result.data?.characters?.sort((a: any, b: any) => {
    return b.updatedAt > a.updatedAt ? 1 : -1
  })

  return result.data?.characters
}

export const getSubscription = async (
  siteId: string,
  account: GeneralAccount,
  customUnidata?: Unidata,
) => {
  const links = await (() => {
    switch (account.type) {
      case "email":
        return (customUnidata || unidata).links.get({
          source: "Crossbell Link",
          identity: account.character.handle,
          platform: "Crossbell",
          filter: { to: siteId },
        })
      case "wallet":
        return (customUnidata || unidata).links.get({
          source: "Crossbell Link",
          identity: account.address,
          platform: "Ethereum",
          filter: { to: siteId },
        })
    }
  })()

  return !!links?.list?.length
}

export const getSiteSubscriptions = async (
  data: {
    siteId: string
    cursor?: string
  },
  customUnidata?: Unidata,
) => {
  const links = await (customUnidata || unidata).links.get({
    source: "Crossbell Link",
    identity: data.siteId,
    platform: "Crossbell",
    reversed: true,
    cursor: data.cursor,
  })

  links?.list.map(async (item: any) => {
    item.character = item.metadata.from_raw
  }) || []

  return links
}

export const getSiteToSubscriptions = async (
  data: {
    siteId: string
    cursor?: string
  },
  customUnidata?: Unidata,
) => {
  const links = await (customUnidata || unidata).links.get({
    source: "Crossbell Link",
    identity: data.siteId,
    platform: "Crossbell",
    cursor: data.cursor,
  })

  links?.list.map(async (item: any) => {
    item.character = item.metadata.to_raw
  }) || []

  return links
}

export async function updateSite(
  payload: {
    site: string
    name?: string
    description?: string
    icon?: string | null
    subdomain?: string
    navigation?: SiteNavigationItem[]
    css?: string
    ga?: string
    custom_domain?: string
    banner?: {
      address: string
      mime_type: string
    }
  },
  customUnidata?: Unidata,
  newbieToken?: string,
) {
  return await (customUnidata || unidata).profiles.set(
    {
      source: "Crossbell Profile",
      identity: payload.site,
      platform: "Crossbell",
      action: "update",
    },
    {
      ...(payload.name && { name: payload.name }),
      ...(payload.description && { bio: payload.description }),
      ...(payload.icon && { avatars: [payload.icon] }),
      ...(payload.banner && { banners: [payload.banner] }),
      ...(payload.subdomain && { username: payload.subdomain }),
      ...((payload.navigation !== undefined ||
        payload.css !== undefined ||
        payload.ga !== undefined ||
        payload.custom_domain !== undefined) && {
        attributes: [
          ...(payload.navigation !== undefined
            ? [
                {
                  trait_type: "xlog_navigation",
                  value: JSON.stringify(payload.navigation),
                },
              ]
            : []),
          ...(payload.css !== undefined
            ? [
                {
                  trait_type: "xlog_css",
                  value: payload.css,
                },
              ]
            : []),
          ...(payload.ga !== undefined
            ? [
                {
                  trait_type: "xlog_ga",
                  value: payload.ga,
                },
              ]
            : []),
          ...(payload.custom_domain !== undefined
            ? [
                {
                  trait_type: "xlog_custom_domain",
                  value: payload.custom_domain,
                },
              ]
            : []),
        ],
      }),
    },
    {
      newbieToken,
    },
  )
}

export async function createSite(
  address: string,
  payload: { name: string; subdomain: string },
  customUnidata?: Unidata,
) {
  return await (customUnidata || unidata).profiles.set(
    {
      source: "Crossbell Profile",
      identity: address,
      platform: "Ethereum",
      action: "add",
    },
    {
      username: payload.subdomain,
      name: payload.name,
      tags: [
        "navigation:" +
          JSON.stringify([
            {
              id: nanoid(),
              label: "Archives",
              url: "/archives",
            },
          ]),
      ],
    },
  )
}

export async function subscribeToSite(
  input: {
    userId: string
    siteId: string
  },
  customUnidata?: Unidata,
) {
  return (customUnidata || unidata).links.set(
    {
      source: "Crossbell Link",
      identity: input.userId,
      platform: "Ethereum",
      action: "add",
    },
    {
      to: input.siteId,
      type: "follow",
    },
  )
}

export async function subscribeToSites(
  input: {
    user: Profile
    sites: {
      characterId: string
    }[]
  },
  contract?: Contract,
) {
  if (input.user.metadata?.proof) {
    return contract?.linkCharactersInBatch(
      input.user.metadata.proof,
      input.sites.map((s) => s.characterId).filter((c) => c) as any,
      [],
      "follow",
    )
  }
}

export async function unsubscribeFromSite(
  input: {
    userId: string
    siteId: string
  },
  customUnidata?: Unidata,
) {
  return (customUnidata || unidata).links.set(
    {
      source: "Crossbell Link",
      identity: input.userId,
      platform: "Ethereum",
      action: "remove",
    },
    {
      to: input.siteId,
      type: "follow",
    },
  )
}

export async function getNotifications(input: { siteCId: string }) {
  const [subscriptions, notes] = await Promise.all([
    indexer.getBacklinksOfCharacter(input.siteCId, {
      limit: 100,
    }),
    indexer.getNotes({
      toCharacterId: input.siteCId,
      limit: 100,
      includeCharacter: true,
    }),
  ])

  return [
    ...(subscriptions.list.map(
      (
        item: LinkEntity & {
          type?: "backlinks"
        },
      ) => {
        item.type = "backlinks"
        return item
      },
    ) as any),
  ]
    .concat(
      notes.list.map(
        (
          item: NoteEntity & {
            type?: "notes"
          },
        ) => {
          item.type = "notes"
          return item
        },
      ),
    )
    .sort((a, b) => {
      return b.createdAt > a.createdAt ? 1 : -1
    })
}

const xLogOperatorPermissions: CharacterOperatorPermission[] = [
  CharacterOperatorPermission.SET_NOTE_URI,
  CharacterOperatorPermission.DELETE_NOTE,
  CharacterOperatorPermission.POST_NOTE,
]

export async function addOperator(
  input: {
    characterId: number
    operator: string
  },
  contract?: Contract,
) {
  if (input.operator && input.characterId) {
    return contract?.grantOperatorPermissionsForCharacter(
      input.characterId,
      input.operator,
      xLogOperatorPermissions,
    )
  }
}

export async function getOperators(input: { characterId?: number }) {
  if (input.characterId) {
    const result = await indexer?.getCharacterOperators(input.characterId, {
      limit: 100,
    })
    result.list = result.list
      .filter(
        (o) =>
          o.operator !== "0x0000000000000000000000000000000000000000" &&
          o.operator !== "0x0f588318a494e4508a121a32b6670b5494ca3357",
      ) // remove 0 and xSync
      .filter((o) => {
        for (const permission of xLogOperatorPermissions) {
          if (!o.permissions.includes(permission)) {
            return false
          }
        }
        return true
      })
    return result
  }
}

export async function isOperators(input: {
  characterId: number
  operator: string
}) {
  if (input.characterId) {
    const permissions =
      (await indexer?.getCharacterOperator(input.characterId, input.operator))
        ?.permissions || []
    for (const permission of xLogOperatorPermissions) {
      if (!permissions.includes(permission)) {
        return false
      }
    }
    return true
  }
  return false
}

export async function removeOperator(
  input: {
    characterId: number
    operator: string
  },
  contract?: Contract,
) {
  if (input.characterId) {
    return contract?.grantOperatorPermissionsForCharacter(
      input.characterId,
      input.operator,
      [],
    )
  }
}

export async function getNFTs(address: string, customUnidata?: Unidata) {
  const assets = await (customUnidata || unidata).assets.get({
    source: "Ethereum NFT",
    identity: address,
  })
  return assets
}
