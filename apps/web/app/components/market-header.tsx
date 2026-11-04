'use client'

import Link from 'next/link'
import { authClient } from '../../lib/auth-client'

export function MarketHeader() {
  const { data: session, isPending } = authClient.useSession()

  async function signOut() {
    await authClient.signOut()
    window.location.href = '/'
  }

  return (
    <header className="market-header">
      <Link className="wordmark market-wordmark" href="/">bizzat</Link>
      <nav className="market-nav" aria-label="Ana menü">
        <Link href="/otomobil">Otomobiller</Link>
        {isPending ? (
          <span className="market-session-status">Oturum…</span>
        ) : session ? (
          <>
            <span className="market-user-name">{session.user.name}</span>
            <button className="market-signout" type="button" onClick={() => void signOut()}>
              Çıkış yap
            </button>
          </>
        ) : (
          <>
            <Link href="/login">Giriş yap</Link>
            <Link href="/register">Hesap oluştur</Link>
          </>
        )}
        <Link className="market-primary-link" href="/ilan-ver/otomobil">İlan ver</Link>
      </nav>
    </header>
  )
}
