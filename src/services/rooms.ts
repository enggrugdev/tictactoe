import { signInAnonymously } from 'firebase/auth'
import {
  onValue,
  ref,
  runTransaction,
  type Unsubscribe,
} from 'firebase/database'
import { firebaseAuth, firebaseConfigured, firebaseDatabase } from './firebase'
import {
  emptyBoard,
  getNextBoard,
  getResult,
  type Board,
  type Mark,
} from '../lib/game'

export type RoomStatus = 'waiting' | 'playing' | 'finished'

export interface Room {
  board: Board
  turn: Mark
  status: RoomStatus
  winner: Mark | ''
  players: { X: string; O: string | null }
  createdAt: number
}

export interface RoomSession {
  code: string
  mark: Mark
  uid: string
  unsubscribe: Unsubscribe
}

function services() {
  if (!firebaseConfigured || !firebaseAuth || !firebaseDatabase) {
    throw new Error('Online play is not configured yet. Add your Firebase settings to .env and try again.')
  }
  return { auth: firebaseAuth, database: firebaseDatabase }
}

async function getAnonymousUid(): Promise<string> {
  const { auth } = services()
  if (auth.currentUser) return auth.currentUser.uid
  const credentials = await signInAnonymously(auth)
  return credentials.user.uid
}

function newRoomCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

export async function createRoom(
  onUpdate: (room: Room | null) => void,
  onError: (error: Error) => void,
): Promise<RoomSession> {
  const { database } = services()
  const uid = await getAnonymousUid()

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newRoomCode()
    const room: Room = {
      board: emptyBoard(),
      turn: 'X',
      status: 'waiting',
      winner: '',
      players: { X: uid, O: null },
      createdAt: Date.now(),
    }
    const result = await runTransaction(ref(database, `rooms/${code}`), (current) => (
      current === null ? room : undefined
    ))
    if (result.committed) {
      return { code, mark: 'X', uid, unsubscribe: listenToRoom(code, onUpdate, onError) }
    }
  }
  throw new Error('Could not create a unique room. Please try again.')
}

export async function joinRoom(
  rawCode: string,
  onUpdate: (room: Room | null) => void,
  onError: (error: Error) => void,
): Promise<RoomSession> {
  const { database } = services()
  const code = rawCode.trim().toUpperCase()
  if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code)) {
    throw new Error('Enter the 8-character room code.')
  }
  const uid = await getAnonymousUid()
  const result = await runTransaction(ref(database, `rooms/${code}`), (current) => {
    if (!current || current.players?.X === uid) return undefined
    if (current.players?.O === uid) return current
    if (current.status !== 'waiting' || current.players?.O) return undefined
    return {
      ...current,
      players: { ...current.players, O: uid },
      status: 'playing',
    }
  })

  if (!result.committed || !result.snapshot.exists()) {
    throw new Error('That room is unavailable or already has two players.')
  }
  return { code, mark: 'O', uid, unsubscribe: listenToRoom(code, onUpdate, onError) }
}

export function listenToRoom(
  code: string,
  onUpdate: (room: Room | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const { database } = services()
  return onValue(ref(database, `rooms/${code}`), (snapshot) => {
    onUpdate(snapshot.exists() ? snapshot.val() as Room : null)
  }, onError)
}

export async function playRoomMove(session: RoomSession, index: number): Promise<void> {
  const { database } = services()
  const result = await runTransaction(ref(database, `rooms/${session.code}`), (current) => {
    if (!current || current.status !== 'playing') return undefined
    const playerMark = current.players?.X === session.uid
      ? 'X'
      : current.players?.O === session.uid ? 'O' : null
    if (playerMark !== session.mark || current.turn !== session.mark) return undefined

    const nextBoard = getNextBoard(current.board as Board, index, session.mark)
    if (!nextBoard) return undefined
    const outcome = getResult(nextBoard)
    return {
      ...current,
      board: nextBoard,
      turn: session.mark === 'X' ? 'O' : 'X',
      status: outcome ? 'finished' : 'playing',
      winner: outcome === 'X' || outcome === 'O' ? outcome : '',
    }
  })
  if (!result.committed) throw new Error('That move is no longer available. Please try again.')
}

export async function resetRoom(session: RoomSession): Promise<void> {
  const { database } = services()
  const result = await runTransaction(ref(database, `rooms/${session.code}`), (current) => {
    if (!current || current.players?.[session.mark] !== session.uid || current.status !== 'finished') {
      return undefined
    }
    return { ...current, board: emptyBoard(), turn: 'X', status: 'playing', winner: '' }
  })
  if (!result.committed) throw new Error('The game could not be restarted. Please try again.')
}
