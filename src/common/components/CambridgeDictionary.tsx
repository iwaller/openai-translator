import React, { useEffect, useState } from 'react'
import { getUniversalFetch } from '../universal-fetch'
import { te } from 'date-fns/locale'

const accessTokenUrl = 'https://aip.baidubce.com/oauth/2.0/token'

interface CambridgeResult {
    uk: string
    us: string
    dic: string
}

function parseText(text: string): CambridgeResult {
    const dicReg = /<span class="hw dhw">([^<]+)<\/span>/gi
    const reg = /<span class="pron dpron[^"]*">\/(((?!\/<\/span).)+)\/<\/span>/gi
    let uk = ''
    let us = ''
    let dic = ''

    let dicMatch
    while (dicMatch = dicReg.exec(text)) {
        dic = dicMatch[1]
    }

    let match = reg.exec(text)
    if (match) {
        us = match[1].replace(/<[^>]+>/gi, '')
        match = reg.exec(text)
        if (match) {
            uk = match[1].replace(/<[^>]+>/gi, '')
        }
    }
    return {
        uk,
        us,
        dic
    }
}

async function getCambridgeResult(word: string): Promise<CambridgeResult | null> {

    if (!word) {
        return null;
    }

    const fetch = getUniversalFetch()

    const url = `https://dictionary.cambridge.org/dictionary/english/${word}`

    const resp = await fetch(url, { cache: 'no-store' })
        .then((response) => response.text())
        .then(parseText)
        .catch(() => null)

    if (!resp || !resp.uk) {
        return null;
    }

    return {
        uk: resp.uk,
        us: resp.us,
        dic: resp.dic
    }
}


export default function CambridgeDictionary(props: { word: string }) {
    const [punct, setPunct] = useState<CambridgeResult | null>(null)
    useEffect(
        () => {
            ; (async () => {
                setPunct(
                    await getCambridgeResult(props.word)
                )
            })()
        },
        [props.word] // refresh on provider / API endpoint change
    )

    if (punct === null) return <></>

    return <div>
        {punct.dic !== props.word ? <span>[{punct.dic}]</span> : null} UK/{punct.uk}/ US/{punct.us}/
    </div>
}
