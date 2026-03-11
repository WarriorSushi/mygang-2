import { describe, it, expect } from 'vitest'
import { urlBase64ToUint8Array } from '../vapid'

describe('urlBase64ToUint8Array', () => {
    it('converts a known base64url string to correct Uint8Array', () => {
        // "AQAB" in base64url = bytes [1, 0, 1]
        const result = urlBase64ToUint8Array('AQAB')
        expect(result).toBeInstanceOf(Uint8Array)
        expect(Array.from(result)).toEqual([1, 0, 1])
    })

    it('handles base64url padding correctly', () => {
        // "AA" base64url = single byte 0x00
        const result = urlBase64ToUint8Array('AA')
        expect(Array.from(result)).toEqual([0])
    })

    it('replaces - and _ with + and /', () => {
        // base64url uses - for + and _ for /
        // "+/" in standard base64 = bytes [0xfb, 0xff] (partial)
        // "-_" in base64url = same
        const resultUrl = urlBase64ToUint8Array('-_8')
        const resultStd = urlBase64ToUint8Array('+/8')
        expect(Array.from(resultUrl)).toEqual(Array.from(resultStd))
    })

    it('handles a 65-byte VAPID-like key', () => {
        // A realistic uncompressed EC P-256 public key is 65 bytes
        // We'll just test that length and type are correct
        const fakeKey = 'BNkPbMRbftOaLq-4Sm8DWLGEHZOY90nP1dq06q8SyA0WuJQ-P4xW_YP-QTTtPt6WjEFCh_Ck0DPGzCT-7BIRj0'
        const result = urlBase64ToUint8Array(fakeKey)
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result.length).toBe(65)
    })

    it('returns empty Uint8Array for empty string', () => {
        const result = urlBase64ToUint8Array('')
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result.length).toBe(0)
    })
})
