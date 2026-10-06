import { describe, expect, it } from 'vitest'
import { emptyBoard, getComputerMove, getNextBoard, getResult, type Board } from './game'

describe('game rules', () => {
  it('detects wins across rows, columns, and diagonals', () => {
    const cases: Board[] = [
      ['X', 'X', 'X', '', '', '', '', '', ''],
      ['O', '', '', 'O', '', '', 'O', '', ''],
      ['X', '', '', '', 'X', '', '', '', 'X'],
      ['', '', 'O', '', 'O', '', 'O', '', ''],
    ]

    expect(cases.map(getResult)).toEqual(['X', 'O', 'X', 'O'])
  })

  it('detects draws and unfinished games', () => {
    expect(getResult(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'])).toBe('draw')
    expect(getResult(emptyBoard())).toBeNull()
  })

  it('rejects occupied, invalid, and post-game moves', () => {
    const board = ['X', '', '', '', '', '', '', '', ''] as Board
    expect(getNextBoard(board, 0, 'O')).toBeNull()
    expect(getNextBoard(board, -1, 'O')).toBeNull()
    expect(getNextBoard(['X', 'X', 'X', '', '', '', '', '', ''] as Board, 3, 'O')).toBeNull()
  })

  it('returns only legal moves for the computer', () => {
    const board = ['X', '', '', '', 'O', '', '', '', ''] as Board
    const move = getComputerMove(board, () => 0.99)
    expect(move).not.toBeNull()
    expect(board[move as number]).toBe('')
  })

  it('takes an immediate win when the computer chooses to play strategically', () => {
    const board = ['O', 'O', '', 'X', 'X', '', '', '', ''] as Board
    expect(getComputerMove(board, () => 0)).toBe(2)
  })
})
