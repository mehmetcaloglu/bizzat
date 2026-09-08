'use client'

import { type FormEvent, useState } from 'react'
import { authClient } from '../../lib/auth-client'

export interface AuthFormProps {
  mode: 'login' | 'register'
}

export function AuthForm({ mode }: AuthFormProps) {
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage('')

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')

    const result = mode === 'register'
      ? await authClient.signUp.email({
          name: String(form.get('name') ?? ''),
          email,
          password,
        })
      : await authClient.signIn.email({ email, password })

    setPending(false)

    if (result.error) {
      setMessage(result.error.message ?? 'İşlem tamamlanamadı.')
      return
    }

    window.location.href = '/'
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      {mode === 'register' ? (
        <label>
          Adın
          <input name="name" autoComplete="name" required />
        </label>
      ) : null}

      <label>
        E-posta
        <input name="email" type="email" autoComplete="email" required />
      </label>

      <label>
        Şifre
        <input
          name="password"
          type="password"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          minLength={8}
          required
        />
      </label>

      <button type="submit" disabled={pending}>
        {pending ? 'Bekle...' : mode === 'register' ? 'Hesap oluştur' : 'Giriş yap'}
      </button>
      <p role="status" aria-live="polite">{message}</p>
    </form>
  )
}
