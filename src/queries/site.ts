import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useContract } from "@crossbell/contract"
import {
  useAccountState,
  useFollowCharacter,
  useFollowCharacters,
  useUnfollowCharacter,
} from "@crossbell/connect-kit"

import * as siteModel from "~/models/site.model"
import { useUnidata } from "./unidata"

export const useAccountSites = () => {
  const unidata = useUnidata()
  const account = useAccountState((s) => s.computed.account)
  const address = account?.type === "email" ? account.email : account?.address

  return useQuery(["getUserSites", address], async () => {
    if (!account) {
      return []
    }

    return siteModel.getAccountSites({ account, unidata })
  })
}

export const useGetSite = (input: string) => {
  const unidata = useUnidata()
  return useQuery(["getSite", input], async () => {
    if (!input) {
      return null
    }
    return siteModel.getSite(input, unidata)
  })
}

export const useGetSites = (input: string[]) => {
  return useQuery(["getSites", input], async () => {
    if (!input) {
      return null
    }
    return siteModel.getSites(input)
  })
}

export const useGetSubscription = (siteId: string | undefined) => {
  const account = useAccountState((s) => s.computed.account)
  const unidata = useUnidata()

  return useQuery(
    ["getSubscription", siteId, account?.characterId],
    async () => {
      if (!account || !siteId) {
        return false
      }

      return siteModel.getSubscription(siteId, account, unidata)
    },
  )
}

export const useGetSiteSubscriptions = (data: { siteId: string }) => {
  const unidata = useUnidata()
  return useQuery(["getSiteSubscriptions", data], async () => {
    if (!data.siteId) {
      return null
    }
    return siteModel.getSiteSubscriptions(data, unidata)
  })
}

export const useGetSiteToSubscriptions = (data: { siteId: string }) => {
  const unidata = useUnidata()
  return useQuery(["getSiteToSubscriptions", data], async () => {
    if (!data.siteId) {
      return null
    }
    return siteModel.getSiteToSubscriptions(data, unidata)
  })
}

export function useUpdateSite() {
  const newbieToken = useAccountState((s) => s.email?.token)
  const unidata = useUnidata()
  const queryClient = useQueryClient()
  const mutation = useMutation(
    async (payload: Parameters<typeof siteModel.updateSite>[0]) => {
      return siteModel.updateSite(payload, unidata, newbieToken)
    },
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries(["getUserSites"])
        queryClient.invalidateQueries(["getSite"])
      },
    },
  )
  return mutation
}

export function useCreateSite() {
  const unidata = useUnidata()
  const queryClient = useQueryClient()
  const account = useAccountState((s) => s.computed.account)
  const address = account?.type === "email" ? account.email : account?.address

  return useMutation(
    async (payload: { name: string; subdomain: string }) => {
      if (address) {
        // FIXME: - Support email users
        return siteModel.createSite(address, payload, unidata)
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["getUserSites", address])
      },
    },
  )
}

export function useSubscribeToSite() {
  const queryClient = useQueryClient()
  const account = useAccountState((s) => s.computed.account)

  return useFollowCharacter({
    onSuccess: (data, { characterId }) => {
      const siteId = `${characterId}`
      return Promise.all([
        queryClient.invalidateQueries(["useGetSiteSubscriptions", siteId]),

        queryClient.invalidateQueries([
          "getSubscription",
          siteId,
          account?.characterId,
        ]),
      ])
    },
  })
}

export function useSubscribeToSites() {
  const queryClient = useQueryClient()
  const currentCharacterId = useAccountState(
    (s) => s.computed.account?.characterId,
  )

  return useFollowCharacters({
    onSuccess: (_, { characterIds = [] }) =>
      Promise.all(
        characterIds.flatMap((characterId) => {
          const siteId = `${characterId}`

          return [
            queryClient.invalidateQueries(["useGetSiteSubscriptions", siteId]),

            queryClient.invalidateQueries([
              "getSubscription",
              siteId,
              currentCharacterId,
            ]),
          ]
        }),
      ),
  })
}

export function useUnsubscribeFromSite() {
  const queryClient = useQueryClient()
  const account = useAccountState((s) => s.computed.account)

  return useUnfollowCharacter({
    onSuccess: (data, { characterId }) => {
      const siteId = `${characterId}`

      return Promise.all([
        queryClient.invalidateQueries(["useGetSiteSubscriptions", siteId]),
        queryClient.invalidateQueries([
          "getSubscription",
          siteId,
          account?.characterId,
        ]),
      ])
    },
  })
}

export const useGetNotifications = (data: { siteCId?: string }) => {
  return useQuery(["getNotifications", data], async () => {
    if (!data.siteCId) {
      return null
    }
    return siteModel.getNotifications({
      siteCId: data.siteCId,
    })
  })
}

export const useGetOperators = (
  data: Parameters<typeof siteModel.getOperators>[0],
) => {
  return useQuery(["getOperators", data], async () => {
    if (!data.characterId) {
      return null
    }
    return siteModel.getOperators(data)
  })
}

export const useIsOperators = (
  data: Partial<Parameters<typeof siteModel.isOperators>[0]>,
) => {
  return useQuery(["isOperators", data], async () => {
    if (!data.characterId || !data.operator) {
      return null
    }
    return siteModel.isOperators({
      characterId: data.characterId,
      operator: data.operator,
    })
  })
}

export function useAddOperator() {
  const contract = useContract()
  const queryClient = useQueryClient()
  return useMutation(
    async (input: Parameters<typeof siteModel.addOperator>[0]) => {
      return siteModel.addOperator(input, contract)
    },
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries([
          "getOperators",
          {
            characterId: variables.characterId,
          },
        ])
        queryClient.invalidateQueries(["isOperators", variables])
      },
    },
  )
}

export function useRemoveOperator() {
  const contract = useContract()
  const queryClient = useQueryClient()
  return useMutation(
    async (input: Partial<Parameters<typeof siteModel.removeOperator>[0]>) => {
      if (!input.operator || !input.characterId) {
        return null
      }
      return siteModel.removeOperator(
        {
          operator: input.operator,
          characterId: input.characterId,
        },
        contract,
      )
    },
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries([
          "getOperators",
          {
            characterId: variables.characterId,
          },
        ])
        queryClient.invalidateQueries(["isOperators", variables])
      },
    },
  )
}

export const useGetNFTs = (address: string) => {
  return useQuery(["getNFTs", address], async () => {
    if (!address) {
      return null
    }
    return await (
      await fetch(
        "/api/nfts?" +
          new URLSearchParams({
            address,
          } as any),
      )
    ).json()
  })
}
