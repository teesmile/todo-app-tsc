import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MovedBanner } from './movedBanner'

describe('the moved banner', () => {
  it('on the old address, says the app has moved and links the same page at the new one', () => {
    render(<MovedBanner location={{ hostname: 'todo-app-tsc-mauve.vercel.app', pathname: '/privacy', search: '' }} />)
    const banner = screen.getByRole('complementary', { name: 'New address' })
    expect(banner).toHaveTextContent('Todo App has moved to todo.anthonyugwuja.dev. Your tasks here are safe: sign in with Google to take them with you, then continue at the new address.')
    expect(screen.getByRole('link', { name: 'todo.anthonyugwuja.dev' })).toHaveAttribute('href', 'https://todo.anthonyugwuja.dev/privacy')
  })

  it('shows nothing anywhere else', () => {
    render(<MovedBanner location={{ hostname: 'todo.anthonyugwuja.dev', pathname: '/', search: '' }} />)
    expect(screen.queryByRole('complementary', { name: 'New address' })).not.toBeInTheDocument()
  })
})
