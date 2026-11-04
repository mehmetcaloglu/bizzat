import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import HomePage from '../app/page'

describe('marketplace home page', () => {
  it('renders Bizzat identity and the public marketplace entry point', () => {
    const html = renderToStaticMarkup(<HomePage />)

    expect(html).toContain('bizzat')
    expect(html).toContain('Aradığın ilanı doğrudan sahibinden bul.')
    expect(html).toContain('Son otomobil ilanları')
  })
})
