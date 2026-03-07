import { Bookmark, bookmarks$, newBookmark } from '@/states/bookmarks'
import pp from 'papaparse'
import * as cheerio from 'cheerio/slim'
import { getPageType, getVideoThumbnail } from './page'
import { showToast } from './toast'
import { normalizeUrl } from './url'
import JSZip from 'jszip'
import { folders$ } from '@/states/folders'

async function getOg(url: string, type: string, videoId?: string): Promise<{ thumbnail?: string; title?: string }> {
  try {
    const res = await fetch(url)
    const html = await res.text()
    const $ = cheerio.load(html)

    const title = $('meta[property="og:title"]').attr('content')
    switch (type) {
      case 'yt-channel':
        const thumbnail = $('meta[property="og:thumbnail"]').attr('content')
        return { title, thumbnail }
      default:
        return {
          title,
        }
    }
  } catch (e) {
    console.error(e)
  }
  return {}
}

/**
 * Visit https://myaccount.google.com/u/0/yourdata/youtube, in the "Your YouTube
 * dashboard" panel, click More -> Download Data. You will get a few csv files.
 */
export async function importCsv(csv: string, filename?: string) {
  const res = pp.parse<string[]>(csv.trim())

  const [col0, col1, col2] = res.data[0]
  const items = res.data.slice(1)

  let bookmarks: Bookmark[] = []
  switch (col0) {
    case 'Channel Id':
      if (col1 == 'Channel Url') {
        // subscriptions.csv
        for (const [id, url, title] of items) {
          const { thumbnail } = await getOg(url, 'yt-channel')
          bookmarks.push(newBookmark({ url, title, json: { thumbnail } }))
        }
      }
      break
    case 'Video ID':
      if (col1 == 'Playlist Video Creation Timestamp') {
        // YouTube [playlist]-videos.csv
        for (const [id] of items) {
          const url = `https://m.youtube.com/watch?v=${id}`
          const { thumbnail, title } = await getOg(url, 'yt-video')
          let folder = undefined
          if (filename) {
            const playlistName = filename?.split('-')[0]
            if (playlistName) {
              folder = folders$.getOrCreateFolder('watch', playlistName)
            }
          }
          bookmarks.push(newBookmark({ url, title: title || '', json: { folder: folder?.id } }))
        }
      } else if (col1 == 'Song Title') {
        // "music library songs.csv"
        for (const [id, title] of items) {
          const url = `https://music.youtube.com/watch?v=${id}`
          bookmarks.push(newBookmark({ url, title }))
        }
      }
      break
    default:
      console.log('failed to parse', filename)
  }

  if (bookmarks.length) {
    const count = bookmarks$.importBookmarks(bookmarks)
    showToast(`🎉 Imported ${count} links from ${filename}`)
  }
}

export async function importZip(zip: JSZip) {
  const promises: Promise<void>[] = []
  zip.forEach((_, file) => {
    const slugs = file.name.split('/')
    // Takeout/YouTube and YouTube Music/channels/channel.csv
    const folder = slugs[2]
    if (file.name.endsWith('.csv') && ['music (library and uploads)', 'playlists', 'subscriptions'].includes(folder)) {
      const fn = async () => {
        const csv = await file.async('string')
        await importCsv(csv, slugs.at(-1))
      }
      promises.push(fn())
    }
  })
  await Promise.all(promises)
}

export async function importList(list: string) {
  let sep = list.includes('\r\n') ? '\r\n' : '\n'
  const lines = list.split(sep)
  let bookmarks: Bookmark[] = []
  for (const line of lines) {
    const pageType = getPageType(line)
    if (!pageType?.canStar) {
      continue
    }
    const url = normalizeUrl(line)
    let type = `${pageType.home}-${pageType.type}`
    const { thumbnail, title } = await getOg(url, type)
    bookmarks.push(newBookmark({ url, title: title || '', json: { thumbnail } }))
  }

  if (bookmarks.length) {
    const count = bookmarks$.importBookmarks(bookmarks)
    showToast(`🎉 Imported ${count} pages`)
  }
}

// URLs from subscriptions.csv
export const subscriptionUrls = [
  'http://www.youtube.com/channel/UC-Hm8vtPdB9DDVFEOJMwBzg',
  'http://www.youtube.com/channel/UC-J-KZfRV8c13fOCkhXdLiQ',
  'http://www.youtube.com/channel/UC-Lq6oBPTgTXT_K-ylWL6hg',
  'http://www.youtube.com/channel/UC-VPf3yXgkbjH6PFKQBblYg',
  'http://www.youtube.com/channel/UC-hzoAk2bSnoqW0LmECa5WA',
  'http://www.youtube.com/channel/UC0QHWhjbe5fGJEPz3sVb6nw',
  'http://www.youtube.com/channel/UC0SFbdQ2CaYrMtSnJ3-B11A',
  'http://www.youtube.com/channel/UC131rygtER0Lm1t_QFNQKZA',
  'http://www.youtube.com/channel/UC1GCDa65yQ2juOaNmtQvr2A',
  'http://www.youtube.com/channel/UC1cbIS7V40JbAoLZ7t_27_A',
  'http://www.youtube.com/channel/UC22BdTgxefuvUivrjesETjg',
  'http://www.youtube.com/channel/UC2MrBc99_fYgkel3nHOvIKA',
  'http://www.youtube.com/channel/UC2V6wM7IgTdB2SZjTN9W1jw',
  'http://www.youtube.com/channel/UC2wdo5vU7bPBNzyC2nnwmNQ',
  'http://www.youtube.com/channel/UC3XTzVzaHQEd30rQbuvCtTQ',
  'http://www.youtube.com/channel/UC3rFZoOXU31LOQZc5hznamA',
  'http://www.youtube.com/channel/UC4-GrpQBx6WCGwmwozP744Q',
  'http://www.youtube.com/channel/UC4GV1pS9ZY6lqNzCZFdVcog',
  'http://www.youtube.com/channel/UC4nDpH0XZtlk0kXr11G_cHQ',
  'http://www.youtube.com/channel/UC55S3Sz4k505P8o5YrCgAYA',
  'http://www.youtube.com/channel/UC5HJaVyYgo7WPCvIBchRBzQ',
  'http://www.youtube.com/channel/UC5NOEUbkLheQcaaRldYW5GA',
  'http://www.youtube.com/channel/UC5Va8SDMp-yviytKMh9YaNQ',
  'http://www.youtube.com/channel/UC5ebo42ydvAayGn2Z4Lf9XA',
  'http://www.youtube.com/channel/UC65XjOZRGlsNmzWmX5fK6WA',
  'http://www.youtube.com/channel/UC6DFoiqfqhCbU6fElNI9sFg',
  'http://www.youtube.com/channel/UC77FGFu9_FM3Cdzldbfa8Aw',
  'http://www.youtube.com/channel/UC7IcJI8PUf5Z3zKxnZvTBog',
  'http://www.youtube.com/channel/UC7JNNXRfLWcDv1a6msdRfJQ',
  'http://www.youtube.com/channel/UC7_gcs09iThXybpVgjHZ_7g',
  'http://www.youtube.com/channel/UC7k9wdrNtKrCY7L6TriAjXA',
  'http://www.youtube.com/channel/UC81BxUCw12jtyvdyv6Hxh-g',
  'http://www.youtube.com/channel/UC87t3AtgLCHKE4E9C6tIywQ',
  'http://www.youtube.com/channel/UC8CLThsPAiYDWo4emAoaWbQ',
  'http://www.youtube.com/channel/UC8Lt51rjGS_RbGQsta-xiEQ',
  'http://www.youtube.com/channel/UC8_aMwsn53tncdH-5iLu8-w',
  'http://www.youtube.com/channel/UC8uj-UFGDzAx3RfPzeRqnyA',
  'http://www.youtube.com/channel/UC9Kq-yEt1iYsbUzNOoIRK0g',
  'http://www.youtube.com/channel/UC9Qixc77KhCo88E5muxUjmA',
  'http://www.youtube.com/channel/UC9Ta8RQydQwHdFwzYt9cnYg',
  'http://www.youtube.com/channel/UC9k-yiEpRHMNVOnOi_aQK8w',
  'http://www.youtube.com/channel/UC9x0AN7BWHpCDHSm9NiJFJQ',
  'http://www.youtube.com/channel/UCAOTrwBpQ3EKerwAYaBpKVA',
  'http://www.youtube.com/channel/UCAPPN8EK6NSxON6wyBdt0_Q',
  'http://www.youtube.com/channel/UCAVu1MQpo8u08Lv_4V4AmGA',
  'http://www.youtube.com/channel/UCAYum5hCyfkSH5T3vSD_kwQ',
  'http://www.youtube.com/channel/UCBHQPOr6BE3-G90a9wB1J3g',
  'http://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ',
  'http://www.youtube.com/channel/UCBeZYVlqOeSSlrBSXl4aTig',
  'http://www.youtube.com/channel/UCBzai1GXVKDdVCrwlKZg_6Q',
  'http://www.youtube.com/channel/UCC4-ZaL0W1R-8MQjKQOujhg',
  'http://www.youtube.com/channel/UCCMUnWvJyTEUunnygpTGfow',
  'http://www.youtube.com/channel/UCClfsa2ZA60lfFBSEgs2_Lg',
  'http://www.youtube.com/channel/UCCljzsYpepeNeY-nKPBKnhA',
  'http://www.youtube.com/channel/UCD1OW2T_f7G6UK-uceKTZwQ',
  'http://www.youtube.com/channel/UCDUF0xHdhKQiw27LVjCpTPg',
  'http://www.youtube.com/channel/UCEF-9XhkdyFY0hMRUkmxXfQ',
  'http://www.youtube.com/channel/UCEIs9nkveW9WmYtsOcJBwTg',
  'http://www.youtube.com/channel/UCEX7TpIRNwShRAwoqVWpIrA',
  'http://www.youtube.com/channel/UCErmMCK1sHF-kCtyHpuSXtQ',
  'http://www.youtube.com/channel/UCFKq_VD6reTowxp4-GB38-Q',
  'http://www.youtube.com/channel/UCFLFc8Lpbwt4jPtY1_Ai5yA',
  'http://www.youtube.com/channel/UCFZO6aPugMrZjUOobX7IQDA',
  'http://www.youtube.com/channel/UCFiaXibzc1HgY3YoNM3cTtA',
  'http://www.youtube.com/channel/UCG0m9a2z1ziRm2YlaFuyU7A',
  'http://www.youtube.com/channel/UCGYKS7rPl7l4SC9nYf2Ofzg',
  'http://www.youtube.com/channel/UCGmFvH5bL4sUerU76Nr2f8A',
  'http://www.youtube.com/channel/UCGt7X90Au6BV8rf49BiM6Dg',
  'http://www.youtube.com/channel/UCHQ4lSaKRap5HyrpitrTOhQ',
  'http://www.youtube.com/channel/UCHbY35okKDb17vWDmCqjicA',
  'http://www.youtube.com/channel/UCHojWKnC2iljNPxKIVleOcg',
  'http://www.youtube.com/channel/UCJ6yMbprj-ZNJU0oguntg0w',
  'http://www.youtube.com/channel/UCJAWXtmA7f0azO1_uvO-HlA',
  'http://www.youtube.com/channel/UCJNgMVaiBmD2W701dALL9Iw',
  'http://www.youtube.com/channel/UCKgAaCGmyCRKgMZD0LBvMNA',
  'http://www.youtube.com/channel/UCLCS7G_8YXULfDSR5ZqB5fg',
  'http://www.youtube.com/channel/UCLhvidUffW8vSUclD7kfrGg',
  'http://www.youtube.com/channel/UCM-yUTYGmrNvKOCcAl21g3w',
  'http://www.youtube.com/channel/UCMOqf8ab-42UUQIdVoKwjlQ',
  'http://www.youtube.com/channel/UCMUyG01MXNeiTykIlvWwIRQ',
  'http://www.youtube.com/channel/UCMpRIJ20nlhdTrTSgGGO6Og',
  'http://www.youtube.com/channel/UCNCktfoFAXtXnMlhjyc9SPA',
  'http://www.youtube.com/channel/UCNIFiHaLZkYASaWDdkC1njg',
  'http://www.youtube.com/channel/UCNIuvl7V8zACPpTmmNIqP2A',
  'http://www.youtube.com/channel/UCNZ14yvsAK-MESWEDVluayw',
  'http://www.youtube.com/channel/UCNqA44cRILQDwm9MG0vV-Og',
  'http://www.youtube.com/channel/UCNrdIlwksTaYnA8Kuek45DA',
  'http://www.youtube.com/channel/UCNyUPYGJ1sOICypq6bEFfig',
  'http://www.youtube.com/channel/UCO2xpFJEJNrwmZ0rS_uJ2iQ',
  'http://www.youtube.com/channel/UCO7dBj4bwaDOMoX-kKYF2Ww',
  'http://www.youtube.com/channel/UCOrX5lJydYtuQ8hIdIShkIA',
  'http://www.youtube.com/channel/UCP4k407eomZThGHo_9sgMkg',
  'http://www.youtube.com/channel/UCP5tjEmvPItGyLhmjdwP7Ww',
  'http://www.youtube.com/channel/UCPF0CtxVDiE3lPxAPJhdSsQ',
  'http://www.youtube.com/channel/UCPSx50w7WavmAXmYowlhNWQ',
  'http://www.youtube.com/channel/UCPg__zM9MzjNjDyyjTDr7ZQ',
  'http://www.youtube.com/channel/UCQCv_bxOPqD5jhfEw_t3SsA',
  'http://www.youtube.com/channel/UCQO62IAzkL8MdezI-FIVJqA',
  'http://www.youtube.com/channel/UCRsPEXICDADAAbyhcs6L3lQ',
  'http://www.youtube.com/channel/UCRyty2RF5SbBbM7M-32BWOg',
  'http://www.youtube.com/channel/UCSDpELfYWHUYXyy3lX2TbPQ',
  'http://www.youtube.com/channel/UCSSkyU4QuH0WldmaGfJzzTQ',
  'http://www.youtube.com/channel/UCSfxFZFzcpYMbOB3A1rWHAg',
  'http://www.youtube.com/channel/UCSnk8pP5cWxvToQl0-Mqf9A',
  'http://www.youtube.com/channel/UCSrZ3UV4jOidv8ppoVuvW9Q',
  'http://www.youtube.com/channel/UCTtj21pQvgoD38_uUlJXK9A',
  'http://www.youtube.com/channel/UCU9U5AOuW_tQa0MJbBvwsJg',
  'http://www.youtube.com/channel/UCUSFHwVFp0QCGLv5EyOF2tg',
  'http://www.youtube.com/channel/UCU_YrpYbVb0Nhk6678AfBGQ',
  'http://www.youtube.com/channel/UCUrkOmXvcHOX4A1ratGe5Wg',
  'http://www.youtube.com/channel/UCUxc0iEpV8wZV4WLOui0RwQ',
  'http://www.youtube.com/channel/UCVUQ8qZUb7q4BKHSC3b-Nqw',
  'http://www.youtube.com/channel/UCVWqt0xrp38kbma9h5MpO3g',
  'http://www.youtube.com/channel/UCVZapV0958xAUsCctF_ED4w',
  'http://www.youtube.com/channel/UCVlGviwwdZuA75bFQ7y8XZg',
  'http://www.youtube.com/channel/UCVv-y0k91qAA-uI_K46UBvg',
  'http://www.youtube.com/channel/UCWFKCr40YwOZQx8FHU_ZqqQ',
  'http://www.youtube.com/channel/UCX6xUemZpeuXSqWM7szcadA',
  'http://www.youtube.com/channel/UCXFZvm0_pzPmWUWAJJ5rDYA',
  'http://www.youtube.com/channel/UCXXTf8_ZOkSpqSWxl2jjefw',
  'http://www.youtube.com/channel/UCXnpNj0KNL6xKFYcICbmHeQ',
  'http://www.youtube.com/channel/UCXtgyCnoA_Ul7eq21gynuAg',
  'http://www.youtube.com/channel/UCXuqSBlHAE6Xw-yeJA0Tunw',
  'http://www.youtube.com/channel/UCXzJGpk9CMcoIjhhbwEAvEg',
  'http://www.youtube.com/channel/UCY1kMZp36IQSyNx_9h4mpCg',
  'http://www.youtube.com/channel/UCY6S78uy7ViTx5-Wc029oqA',
  'http://www.youtube.com/channel/UCYNbYGl89UUowy8oXkipC-Q',
  'http://www.youtube.com/channel/UCYc_PiUYzGJMERtgL3tyJTw',
  'http://www.youtube.com/channel/UCYxezj89xof3XRLFqly20VA',
  'http://www.youtube.com/channel/UCZ4AMrDcNrfy3X6nsU8-rPg',
  'http://www.youtube.com/channel/UCZrs37HbHMGLMtz6pUuWeSA',
  'http://www.youtube.com/channel/UC_BrkoB_8x7QVHdrIWy7nMQ',
  'http://www.youtube.com/channel/UC_gSotrFVZ_PiAxo3fTQVuQ',
  'http://www.youtube.com/channel/UC_iUeUzozCHEReJ-shKcCYA',
  'http://www.youtube.com/channel/UCaWv5hdWKJeuLrPAbISnssg',
  'http://www.youtube.com/channel/UCaqcvH8EvUtePORpN03jLMg',
  'http://www.youtube.com/channel/UCb1Ti1WKPauPpXkYKVHNpsw',
  'http://www.youtube.com/channel/UCbaAyXYMnbQu0BGGPbvxHsw',
  'http://www.youtube.com/channel/UCbq544I2cTyvcrZwmnSIj9Q',
  'http://www.youtube.com/channel/UCc8AuEDxwSWFQP8ti0xfEJg',
  'http://www.youtube.com/channel/UCc9k-GSEeOkA_VlwhWfi0_A',
  'http://www.youtube.com/channel/UCcyq283he07B7_KUX07mmtA',
  'http://www.youtube.com/channel/UCd5Os4gT74gxngzUYqGUzzg',
  'http://www.youtube.com/channel/UCdNdq31oz-Gcfcce5ueMR2Q',
  'http://www.youtube.com/channel/UCdvR0U-oCIoIlpSSErO8A5w',
  'http://www.youtube.com/channel/UCe6ye3l9WA4SdNkqgs0YeMA',
  'http://www.youtube.com/channel/UCeCN-B9Q-6011cE3nx5CtNA',
  'http://www.youtube.com/channel/UCenxjWEkb0Sv67vejOgZ3Tg',
  'http://www.youtube.com/channel/UCevQIQJht1iUyI9c5ELZ8RA',
  'http://www.youtube.com/channel/UCf4YizfEQiftTFR4qbvb5Qw',
  'http://www.youtube.com/channel/UCf9BO33b-MnIxB5y0azrxmg',
  'http://www.youtube.com/channel/UCfk4Df9QxO267wlFbStSyAw',
  'http://www.youtube.com/channel/UCfp_KL9fMARFv7STuZswogA',
  'http://www.youtube.com/channel/UCfxFsg2KOpgXq2GiEb2Vk0A',
  'http://www.youtube.com/channel/UCgbzclo4Mfy_D68w_Bm_xHg',
  'http://www.youtube.com/channel/UCgilhqoyZrXV2EBlaaAtVaw',
  'http://www.youtube.com/channel/UCgtNWWCk8QhqK-pvFbn-wLw',
  'http://www.youtube.com/channel/UCh_GQqobenO55IJ9sYZWndA',
  'http://www.youtube.com/channel/UChirEOpgFCupRAk5etXqPaA',
  'http://www.youtube.com/channel/UChuHXx5Yursi4D1JdIU93XA',
  'http://www.youtube.com/channel/UCi7piZmMfCPsM7RwXk-WTIg',
  'http://www.youtube.com/channel/UCieoX2aGYzzxKXk5i57zPcQ',
  'http://www.youtube.com/channel/UCijh2e0C7L4haTJIvgLzRXA',
  'http://www.youtube.com/channel/UCixD9UbKvDxzGNiPC_fgHyA',
  'http://www.youtube.com/channel/UCj7ADiT-RzESYpAd90OeEKA',
  'http://www.youtube.com/channel/UCjOT5dLJUc60HFJiphmFh1g',
  'http://www.youtube.com/channel/UCjZFrboJBq8HJzPKzQeiVlQ',
  'http://www.youtube.com/channel/UCjzcAEdtPjSo3hRrhVnVaQg',
  'http://www.youtube.com/channel/UCk4T7MXQI5_UP2Vr-Dk-RiA',
  'http://www.youtube.com/channel/UCk579PPZcfzD0I0vyXQFttA',
  'http://www.youtube.com/channel/UCk7L0Sp0oxeODKuSMQ7aQqg',
  'http://www.youtube.com/channel/UCkDwexrF43p_1QurfKFBCBA',
  'http://www.youtube.com/channel/UCkQef3Fidr7tm3gNuXgGKPw',
  'http://www.youtube.com/channel/UCkRiPY0hPYZh96RQShizu6w',
  'http://www.youtube.com/channel/UCkaSFi0vjiSI0eao5jS9AZQ',
  'http://www.youtube.com/channel/UClIpxKAC9kaOgjexqrvan9g',
  'http://www.youtube.com/channel/UClZbmi9JzfnB2CEb0fG8iew',
  'http://www.youtube.com/channel/UCmCcSVGNZ4x8ZMbWDBhbIAA',
  'http://www.youtube.com/channel/UCmyPr7TbvE9ycl9PL-UiA5A',
  'http://www.youtube.com/channel/UCn7vLnvEI4N6CoM2e4XXbtA',
  'http://www.youtube.com/channel/UCo10yRzepDzIt7B7w2wnM1Q',
  'http://www.youtube.com/channel/UCoAkOJtcToS0piLQMO-W4uw',
  'http://www.youtube.com/channel/UCoCbt0YNJL4_MtIo6Lg1ybA',
  'http://www.youtube.com/channel/UCoFiap7J9HtmcILlLESpW2g',
  'http://www.youtube.com/channel/UCoPifNGnfskLkAiJq0qxQaA',
  'http://www.youtube.com/channel/UCoqGJPtvsPpALlhtqB1lcHA',
  'http://www.youtube.com/channel/UCoukDPjrBTbDqBlosrV3qOw',
  'http://www.youtube.com/channel/UCovVc-qqwYp8oqwO3Sdzx7w',
  'http://www.youtube.com/channel/UCp2e-KuXG1cwkb1KrcEYYrQ',
  'http://www.youtube.com/channel/UCpVm7bg6pXKo1Pr6k5kxG9A',
  'http://www.youtube.com/channel/UCpa-Zb0ZcQjTCPP1Dx_1M8Q',
  'http://www.youtube.com/channel/UCphEo21J3_rev7hVg-kHAOQ',
  'http://www.youtube.com/channel/UCphTF9wHwhCt-BzIq-s4V-g',
  'http://www.youtube.com/channel/UCphqjYZxxzjNbONVmY-0J7Q',
  'http://www.youtube.com/channel/UCpuqYFKLkcEryEieomiAv3Q',
  'http://www.youtube.com/channel/UCpzpOZWN_GSrNkiUF-1c19Q',
  'http://www.youtube.com/channel/UCqBgIIiRCx2a8665eAXf2gw',
  'http://www.youtube.com/channel/UCqZQJ4600a9wIfMPbYc60OQ',
  'http://www.youtube.com/channel/UCqf-C-dxAFNWKYZG61PYn8A',
  'http://www.youtube.com/channel/UCqhBwbWSZWi_wueVDYK3a5Q',
  'http://www.youtube.com/channel/UCqkrHC2Rt6LXbxarIF1GQQA',
  'http://www.youtube.com/channel/UCqnbDFdCpuN8CMEg0VuEBqA',
  'http://www.youtube.com/channel/UCr0XW6TU9XVWlWPpEwEyf3g',
  'http://www.youtube.com/channel/UCromZ2GyARy5SNeH-3VFqzw',
  'http://www.youtube.com/channel/UCsTY_yPMJWO438JgvfXZlKg',
  'http://www.youtube.com/channel/UCsXVk37bltHxD1rDPwtNM8Q',
  'http://www.youtube.com/channel/UCsykY6wbhmr7CV-zUoqLkug',
  'http://www.youtube.com/channel/UCtAXJ4DNpshfVjLIMq9pIRw',
  'http://www.youtube.com/channel/UCtCzgBYlAcO05gQAT605Nng',
  'http://www.youtube.com/channel/UCtMVHI3AJD4Qk4hcbZnI9ZQ',
  'http://www.youtube.com/channel/UCtgGOdTlM-NdJ9rPKIYN8UQ',
  'http://www.youtube.com/channel/UCu1aSs2qmjySrt_HkEmblvQ',
  'http://www.youtube.com/channel/UCuEi61790Pnm-sIRZZj1YPg',
  'http://www.youtube.com/channel/UCueYcgdqos0_PzNOq81zAFg',
  'http://www.youtube.com/channel/UCuedf_fJVrOppky5gl3U6QQ',
  'http://www.youtube.com/channel/UCuzzuTQH0FTqNg2LGT8QS0Q',
  'http://www.youtube.com/channel/UCv9vCS6Jon3BQTgn83vD7vA',
  'http://www.youtube.com/channel/UCvdnX4xRyt3oTW4et446_Ow',
  'http://www.youtube.com/channel/UCw8PmxZJxTsem5nb6TcB23g',
  'http://www.youtube.com/channel/UCwZBK4UDWlh4966pdX4JBjQ',
  'http://www.youtube.com/channel/UCx6xmIOXqnQ79ZI6VVpARXw',
  'http://www.youtube.com/channel/UCxPXcReyAQwlbFVHBdvZz_g',
]

/**
 * Import all subscription URLs as bookmarks
 */
export async function importSubscriptions() {
  let bookmarks: Bookmark[] = []
  for (const url of subscriptionUrls) {
    const { thumbnail, title } = await getOg(url, 'yt-channel')
    bookmarks.push(newBookmark({ url, title: title || '', json: { thumbnail } }))
  }

  if (bookmarks.length) {
    const count = bookmarks$.importBookmarks(bookmarks)
    showToast(`🎉 Imported ${count} subscription channels`)
  }
}
