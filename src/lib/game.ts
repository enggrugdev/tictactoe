export type Mark = 'X' | 'O'
export type Cell = Mark | ''
export type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell]
export type GameResult = Mark | 'draw' | null

export const emptyBoard = (): Board => ['', '', '', '', '', '', '', '', '']

const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const

export function getResult(board: Board): GameResult {
  for (const [a, b, c] of winningLines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]
    }
  }
  return board.every(Boolean) ? 'draw' : null
}

export function getNextBoard(board: Board, index: number, mark: Mark): Board | null {
  if (!Number.isInteger(index) || index < 0 || index >= board.length || board[index] !== '' || getResult(board)) {
    return null
  }
  const next = [...board] as Board
  next[index] = mark
  return next
}

export function getComputerMove(board: Board, random = Math.random): number | null {
  if (getResult(board)) return null
  const available = board.flatMap((cell, index) => (cell === '' ? [index] : []))
  if (available.length === 0) return null

  if (random() < 0.65) {
    const winningMove = findImmediateMove(board, 'O')
    if (winningMove !== null) return winningMove

    const blockingMove = findImmediateMove(board, 'X')
    if (blockingMove !== null) return blockingMove
  }

  return available[Math.floor(random() * available.length)] ?? null
}

function findImmediateMove(board: Board, mark: Mark): number | null {
  for (let index = 0; index < board.length; index += 1) {
    if (board[index] !== '') continue
    const candidate = [...board] as Board
    candidate[index] = mark
    if (getResult(candidate) === mark) return index
  }
  return null
}
