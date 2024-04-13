/* eslint-disable camelcase */
import { fetchSSE, getSettings } from '../utils'
import { AbstractEngine } from './abstract-engine'
import { IMessageRequest, IModel } from './interfaces'
import { getUniversalFetch } from '../universal-fetch'

import * as utils from '../utils'

export class Baidu extends AbstractEngine {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async listModels(apiKey_: string | undefined): Promise<IModel[]> {
        return [
            {
                id: 'ernie-3.5-8k-0205',
                name: 'ERNIE-3.5-8K-0205',
            },
            {
                id: 'ernie-3.5-4k-0205',
                name: 'ERNIE-3.5-4K-0205'
            },
            {
                id: 'ernie-3.5-8k-1222',
                name: 'ERNIE-3.5-8K-1222'
            },
            {
                id: 'ernie-4.0-8k',
                name: 'ERNIE-4.0-8K'
            }
        ]
    }

    async getModel(): Promise<string> {
        const settings = await getSettings()
        return settings.baiduAPIModel
    }

    async sendMessage(req: IMessageRequest): Promise<void> {
        const settings = await getSettings()
        const model = await this.getModel()
        const clientId = settings.baiduClientId
        const clientSecret = settings.baiduClientSecret
        let baiduAccessToken = settings.baiduAccessToken
        let baiduAccessTokenExpiresAt = settings.baiduAccessTokenExpiresAt || 0

        const now = new Date().getTime()
        if(!baiduAccessToken || baiduAccessTokenExpiresAt < now) {
            const token = await getAccessToken(clientId, clientSecret)
            baiduAccessToken = token.accessToken
            baiduAccessTokenExpiresAt = token.expiresAt
            await utils.setSettings({...settings, baiduAccessToken, baiduAccessTokenExpiresAt})
        }

        const url = `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${model}?access_token=${baiduAccessToken}`
        const headers = {
            'Content-Type': 'application/json',
        }
        const body = {
            temperature: 0.01,
            stream: true,
            system: req.rolePrompt,
            messages: [
                {
                    role: 'user',
                    content: req.commandPrompt,
                },
            ]
        }
        let finished = false
        await fetchSSE(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: req.signal,
            onMessage: async (msg) => {
                if (finished) return
                let resp
                try {
                    resp = JSON.parse(msg)
                    // eslint-disable-next-line no-empty
                } catch {
                    req.onFinished('stop')
                    finished = true
                    return
                }

                const { result, is_result, finish_reason: finishReason } = resp
                if (finishReason != 'normal') {
                    req.onFinished(finishReason)
                    finished = true
                    return
                }

                await req.onMessage({ content: result, role: '' })
            },
            onError: (err) => {
                if (err instanceof Error) {
                    req.onError(err.message)
                    return
                }
                if (typeof err === 'string') {
                    req.onError(err)
                    return
                }
                if (typeof err === 'object') {
                    const { detail } = err
                    if (detail) {
                        req.onError(detail)
                        return
                    }
                }
                const { error } = err
                if (error instanceof Error) {
                    req.onError(error.message)
                    return
                }
                if (typeof error === 'object') {
                    const { message } = error
                    if (message) {
                        if (typeof message === 'string') {
                            req.onError(message)
                        } else {
                            req.onError(JSON.stringify(message))
                        }
                        return
                    }
                }
                req.onError('Unknown error')
            },
        })
    }
}

interface AccessToken {
    accessToken: string
    expiresAt: number
}

const accessTokenUrl = 'https://aip.baidubce.com/oauth/2.0/token'

async function getAccessToken(clientId: string, clientSecret: string): Promise<AccessToken> {
    const fetch = getUniversalFetch()

    const url = `${accessTokenUrl}?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`

    const resp = await fetch(url, { cache: 'no-store' })
        .then((response) => response.json())
        .catch(() => '')
    const now = new Date().getTime()
    return {
        accessToken: resp.access_token,
        expiresAt: now + resp.expires_in * 1000,
    }
}
