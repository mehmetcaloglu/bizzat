import Link from 'next/link'
import { AuthForm } from '../components/auth-form'

export default function RegisterPage() {
  return (
    <main className="foundation-shell">
      <section>
        <p className="wordmark">bizzat</p>
        <h1>Hesap oluştur</h1>
        <p>Şifren en az 8 karakter olmalı.</p>
        <AuthForm mode="register" />
        <p>Zaten hesabın var mı? <Link href="/login">Giriş yap</Link></p>
      </section>
    </main>
  )
}
