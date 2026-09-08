'use client'

import Link from 'next/link'
import { authClient } from '../../lib/auth-client'

export function SessionPanel() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return <p>Oturum kontrol ediliyor...</p>

  if (!session) {
    return (
      <div className="session-actions">
        <Link href="/login">Giriş yap</Link>
        <Link href="/register">Hesap oluştur</Link>
      </div>
    )
  }

  async function signOut() {
    await authClient.signOut()
    window.location.href = '/'
  }

  return (
    <div className="session-panel">
      <p><strong>{session.user.name}</strong></p>
      <p>{session.user.email}</p>
      <button type="button" onClick={() => void signOut()}>Çıkış yap</button>
    </div>
  )
}
