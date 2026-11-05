'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getMe } from '../../lib/api-client'
import { authClient } from '../../lib/auth-client'

export function MarketHeader() {
  const { data: session, isPending } = authClient.useSession()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      setRole(null)
      return
    }
    let cancelled = false
    void getMe()
      .then((me) => {
        if (!cancelled) setRole(me.profile.role)
      })
      .catch(() => {
        if (!cancelled) setRole(null)
      })
    return () => {
      cancelled = true
    }
  }, [session?.user.id])

  async function signOut() {
    await authClient.signOut()
    window.location.href = '/'
  }

  return (
    <header className="market-header">
      <Link className="wordmark market-wordmark" href="/">bizzat</Link>
      <nav className="market-nav" aria-label="Ana menü">
        <Link href="/otomobil">Otomobiller</Link>
        <Link href="/daire">Daireler</Link>
        {isPending ? (
          <span className="market-session-status">Oturum…</span>
        ) : session ? (
          <>
            <Link href="/ilanlarim">İlanlarım</Link>
            <Link href="/hesabim">Hesabım</Link>
            {(role === 'moderator' || role === 'admin') && (
              <>
                <Link href="/destek">Destek</Link>
                <Link href="/moderasyon/raporlar">Moderasyon</Link>
                <Link href="/moderasyon/itirazlar">İtirazlar</Link>
              </>
            )}
            {role === 'admin' && <Link href="/yonetim">Yönetim</Link>}
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
        <Link className="market-primary-link" href="/ilan-ver">İlan ver</Link>
      </nav>
    </header>
  )
}
