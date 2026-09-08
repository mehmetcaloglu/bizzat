import Link from 'next/link'
import { AuthForm } from '../components/auth-form'

export default function LoginPage() {
  return (
    <main className="foundation-shell">
      <section>
        <p className="wordmark">bizzat</p>
        <h1>Giriş yap</h1>
        <AuthForm mode="login" />
        <p>Hesabın yok mu? <Link href="/register">Hesap oluştur</Link></p>
      </section>
    </main>
  )
}
