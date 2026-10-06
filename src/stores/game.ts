import { defineStore } from 'pinia'
import {
  emptyBoard,
  getComputerMove,
  getNextBoard,
  getResult,
  type Board,
  type GameResult,
  type Mark,
} from '../lib/game'
import {
  createRoom,
  joinRoom,
  playRoomMove,
  resetRoom,
  type Room,
  type RoomSession,
} from '../services/rooms'

type Mode = 'menu' | 'single' | 'online'

export const useGameStore = defineStore('game', {
  state: () => ({
    mode: 'menu' as Mode,
    board: emptyBoard() as Board,
    turn: 'X' as Mark,
    result: null as GameResult,
    isThinking: false,
    room: null as Room | null,
    roomSession: null as RoomSession | null,
    roomBusy: false,
    roomError: '',
    lastCreatedCode: '',
  }),
  getters: {
    gameOver: (state) => state.result !== null,
    isMyTurn: (state) => Boolean(state.roomSession && state.room?.turn === state.roomSession.mark),
  },
  actions: {
    startSingle() {
      this.clearRoom()
      this.mode = 'single'
      this.board = emptyBoard()
      this.turn = 'X'
      this.result = null
      this.isThinking = false
    },
    returnToMenu() {
      this.clearRoom()
      this.mode = 'menu'
      this.roomError = ''
      this.isThinking = false
    },
    resetSingle() {
      this.board = emptyBoard()
      this.turn = 'X'
      this.result = null
      this.isThinking = false
    },
    playSingle(index: number) {
      if (this.mode !== 'single' || this.turn !== 'X' || this.result) return
      const nextBoard = getNextBoard(this.board, index, 'X')
      if (!nextBoard) return
      this.board = nextBoard
      this.result = getResult(nextBoard)
      if (!this.result) {
        this.turn = 'O'
        this.isThinking = true
      }
    },
    playComputerMove(random = Math.random) {
      if (this.mode !== 'single' || this.turn !== 'O' || this.result) return
      const index = getComputerMove(this.board, random)
      if (index === null) return
      const nextBoard = getNextBoard(this.board, index, 'O')
      if (!nextBoard) return
      this.board = nextBoard
      this.result = getResult(nextBoard)
      this.turn = 'X'
      this.isThinking = false
    },
    async createOnlineRoom() {
      this.roomBusy = true
      this.roomError = ''
      this.clearRoom()
      this.mode = 'online'
      try {
        this.roomSession = await createRoom(
          (room) => { this.room = room },
          (error) => { this.roomError = error.message },
        )
        this.lastCreatedCode = this.roomSession.code
      } catch (error) {
        this.roomError = error instanceof Error ? error.message : 'Could not create a room.'
      } finally {
        this.roomBusy = false
      }
    },
    async joinOnlineRoom(code: string) {
      this.roomBusy = true
      this.roomError = ''
      this.clearRoom()
      this.mode = 'online'
      try {
        this.roomSession = await joinRoom(
          code,
          (room) => { this.room = room },
          (error) => { this.roomError = error.message },
        )
      } catch (error) {
        this.roomError = error instanceof Error ? error.message : 'Could not join the room.'
      } finally {
        this.roomBusy = false
      }
    },
    async playOnline(index: number) {
      if (!this.roomSession || !this.isMyTurn || this.room?.status !== 'playing') return
      this.roomError = ''
      try {
        await playRoomMove(this.roomSession, index)
      } catch (error) {
        this.roomError = error instanceof Error ? error.message : 'That move could not be played.'
      }
    },
    async resetOnline() {
      if (!this.roomSession) return
      this.roomError = ''
      try {
        await resetRoom(this.roomSession)
      } catch (error) {
        this.roomError = error instanceof Error ? error.message : 'The game could not be restarted.'
      }
    },
    clearRoom() {
      this.roomSession?.unsubscribe()
      this.roomSession = null
      this.room = null
      this.lastCreatedCode = ''
    },
  },
})
