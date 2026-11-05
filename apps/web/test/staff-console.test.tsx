import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AccountPage from '../app/hesabim/page'
import StaffPage from '../app/destek/page'
import AdminPage from '../app/yonetim/page'
import { AccountStatusView } from '../app/components/account-status'
import { StaffConsole } from '../app/components/staff-console'
import { SuperAdminConsole } from '../app/components/super-admin-console'

describe('staff and account surfaces', () => {
  it('renders the customer service page shell and initial console', () => {
    const page = renderToStaticMarkup(<StaffPage />)
    expect(page).toContain('Destek paneli')
    expect(page).toContain('Kullanıcıları ara')

    const consoleView = renderToStaticMarkup(<StaffConsole />)
    expect(consoleView).toContain('Kullanıcı ara')
    expect(consoleView).toContain('Bir kullanıcı seç.')
  })

  it('renders the super admin page shell and loading state', () => {
    const page = renderToStaticMarkup(<AdminPage />)
    expect(page).toContain('Bizzat yönetimi')
    expect(page).toContain('Süper admin')

    const loading = renderToStaticMarkup(<SuperAdminConsole />)
    expect(loading).toContain('Yönetim paneli yükleniyor…')
  })

  it('renders the account page shell and loading state', () => {
    const page = renderToStaticMarkup(<AccountPage />)
    expect(page).toContain('Hesap durumun')
    expect(page).toContain('uyarıları')

    const loading = renderToStaticMarkup(<AccountStatusView />)
    expect(loading).toContain('Hesap bilgileri yükleniyor…')
  })
})
