import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import LoginPage from '../app/login/page'
import RegisterPage from '../app/register/page'

describe('identity pages', () => {
  it('renders the login form', () => {
    const html = renderToStaticMarkup(<LoginPage />)
    expect(html).toContain('Giriş yap')
    expect(html).toContain('E-posta')
    expect(html).toContain('Şifre')
  })

  it('renders the registration form', () => {
    const html = renderToStaticMarkup(<RegisterPage />)
    expect(html).toContain('Hesap oluştur')
    expect(html).toContain('Adın')
    expect(html).toContain('en az 8 karakter')
  })
})
