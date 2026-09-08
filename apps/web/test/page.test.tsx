import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import HomePage from '../app/page'

describe('foundation home page', () => {
  it('renders Bizzat identity', () => {
    const html = renderToStaticMarkup(<HomePage />)

    expect(html).toContain('bizzat')
    expect(html).toContain('Bireysel ilanların adresi.')
  })
})
