import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          name: 'Mehmet',
          email: 'mehmet@example.com',
        },
      },
      isPending: false,
    }),
    signOut: vi.fn(),
  },
}))

import { MarketHeader } from '../app/components/market-header'

describe('market account header', () => {
  it('shows the signed-in user and logout action', () => {
    const html = renderToStaticMarkup(<MarketHeader />)

    expect(html).toContain('Mehmet')
    expect(html).toContain('Çıkış yap')
    expect(html).not.toContain('Hesap oluştur')
  })
})
