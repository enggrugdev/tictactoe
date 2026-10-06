<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useGameStore } from './stores/game'
import { firebaseConfigured } from './services/firebase'

type ThemeMode = 'light' | 'system' | 'dark'

const themeOptions: { label: string; value: ThemeMode }[] = [
  { label: 'Light', value: 'light' },
  { label: 'System', value: 'system' },
  { label: 'Dark', value: 'dark' },
]
const themePreferenceKey = 'tic-tac-toe-theme'
function loadThemeMode(): ThemeMode {
  try {
    const storedMode = localStorage.getItem(themePreferenceKey)
    if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') return storedMode
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
  return 'system'
}

const themeMode = ref<ThemeMode>(loadThemeMode())
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
const systemPrefersDark = ref(systemThemeQuery.matches)

watch([themeMode, systemPrefersDark], ([mode, prefersDark]) => {
  const resolvedTheme = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode
  document.documentElement.dataset.theme = resolvedTheme
  document.documentElement.style.colorScheme = resolvedTheme
  try {
    localStorage.setItem(themePreferenceKey, mode)
  } catch {
    // The selected mode still applies for this session.
  }
}, { immediate: true })

const game = useGameStore()
const {
  mode,
  board,
  turn,
  result,
  isThinking,
  room,
  roomSession,
  roomBusy,
  roomError,
  lastCreatedCode,
  gameOver,
  isMyTurn,
} = storeToRefs(game)
const joinCode = ref('')
const copied = ref(false)
let aiTimer: ReturnType<typeof setTimeout> | undefined

const singleStatus = computed(() => {
  if (result.value === 'X') return 'You win!'
  if (result.value === 'O') return 'The computer wins'
  if (result.value === 'draw') return "It's a draw"
  if (isThinking.value) return 'Thinking…'
  return 'Your turn'
})
const onlineStatus = computed(() => {
  if (!roomSession.value) return 'Create a room or enter a code to play online.'
  if (!room.value) return 'Connecting to your room…'
  if (room.value.status === 'waiting') return 'Waiting for a friend to join…'
  if (room.value.status === 'finished') {
    if (room.value.winner === '') return "It's a draw"
    return room.value.winner === roomSession.value.mark ? 'You win!' : 'Your friend wins'
  }
  return isMyTurn.value ? 'Your turn' : "Your friend's turn"
})
const displayBoard = computed(() => mode.value === 'online' ? room.value?.board ?? board.value : board.value)
const canPlay = computed(() => {
  if (mode.value === 'single') return !gameOver.value && turn.value === 'X' && !isThinking.value
  return mode.value === 'online' && Boolean(room.value?.status === 'playing' && isMyTurn.value)
})

watch(isThinking, (thinking) => {
  if (aiTimer) clearTimeout(aiTimer)
  if (thinking) aiTimer = setTimeout(() => game.playComputerMove(), 550)
})

function updateSystemTheme(event: MediaQueryListEvent) {
  systemPrefersDark.value = event.matches
}

systemThemeQuery.addEventListener('change', updateSystemTheme)

onBeforeUnmount(() => {
  if (aiTimer) clearTimeout(aiTimer)
  systemThemeQuery.removeEventListener('change', updateSystemTheme)
  game.clearRoom()
})

async function submitJoin() {
  await game.joinOnlineRoom(joinCode.value)
}

async function copyCode() {
  if (!lastCreatedCode.value) return
  try {
    await navigator.clipboard.writeText(lastCreatedCode.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1600)
  } catch {
    roomError.value = 'Could not copy the room code. Select and copy it manually.'
  }
}

function clickCell(index: number) {
  if (!canPlay.value || displayBoard.value[index] !== '') return
  if (mode.value === 'single') game.playSingle(index)
  else void game.playOnline(index)
}

function newGame() {
  if (mode.value === 'online') void game.resetOnline()
  else game.resetSingle()
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Tic-Tac-Toe home" @click.prevent="game.returnToMenu()">
        <span class="brand-mark" aria-hidden="true"><i></i><b></b><em></em></span>
        <span>tic<span class="brand-dot">.</span>tac<span class="brand-dot">.</span>toe</span>
      </a>
      <div class="topbar-tools">
        <span class="topbar-note"><span class="online-dot"></span> GOOD VIBES, GREAT MOVES</span>
        <div class="theme-switch" role="group" aria-label="Color theme">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            type="button"
            :aria-pressed="themeMode === option.value"
            @click="themeMode = option.value"
          >{{ option.label }}</button>
        </div>
      </div>
    </header>

    <section v-if="mode === 'menu'" class="landing">
      <div class="eyebrow"><span class="eyebrow-line"></span> THE CLASSIC, REIMAGINED</div>
      <h1>One board.<br /><span>Endless</span> rematches.</h1>
      <p class="landing-copy">A little strategy, a little luck, and one more game than you planned.</p>
      <div class="mode-grid">
        <button class="mode-card single-card" @click="game.startSingle()">
          <span class="card-icon icon-solo" aria-hidden="true"><span>×</span><span>○</span></span>
          <span class="card-meta">01 / SOLO</span>
          <strong>Play solo</strong>
          <span class="card-description">Take on the computer.<br />Your move, your moment.</span>
          <span class="card-action">LET'S PLAY <span>↗</span></span>
        </button>
        <button class="mode-card online-card" @click="mode = 'online'; roomError = ''">
          <span class="card-icon icon-online" aria-hidden="true">↗</span>
          <span class="card-meta">02 / TOGETHER</span>
          <strong>Play online</strong>
          <span class="card-description">Invite a friend with a room code.<br />Let the rivalry begin.</span>
          <span class="card-action">FIND A FRIEND <span>↗</span></span>
        </button>
      </div>
      <div class="landing-footer"><span>✳</span> FREE TO PLAY <span class="footer-divider"></span> MADE FOR THE REMATCH</div>
    </section>

    <section v-else-if="mode === 'single'" class="game-view">
      <button class="back-link" @click="game.returnToMenu()">← <span>ALL MODES</span></button>
      <div class="game-heading">
        <div class="eyebrow"><span class="eyebrow-line"></span> SOLO MODE</div>
        <h1>Your move<span>.</span></h1>
        <p>A little strategy goes a long way.</p>
      </div>
      <div class="matchup"><span class="match-player"><i class="mark-x">×</i> YOU</span><span class="match-divider">VS</span><span class="match-player">COMPUTER <i class="mark-o">○</i></span></div>
      <div class="status-pill" :class="{ 'status-win': gameOver }"><span class="status-dot"></span>{{ singleStatus }}</div>
      <div class="board" role="grid" aria-label="Tic-Tac-Toe board">
        <button
          v-for="(cell, index) in board"
          :key="index"
          class="cell"
          :class="[`cell-${cell.toLowerCase()}`, { 'cell-disabled': !canPlay || cell }]"
          :disabled="!canPlay || Boolean(cell)"
          :aria-label="`Row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}${cell ? `, ${cell}` : ', empty'}`"
          role="gridcell"
          @click="clickCell(index)"
        >{{ cell === 'X' ? '×' : cell === 'O' ? '○' : '' }}</button>
      </div>
      <button class="subtle-button" @click="newGame()">{{ gameOver ? 'PLAY AGAIN' : 'RESTART GAME' }} <span>↻</span></button>
    </section>

    <section v-else class="game-view online-view">
      <button class="back-link" @click="game.returnToMenu()">← <span>ALL MODES</span></button>
      <template v-if="!roomSession">
        <div class="game-heading">
          <div class="eyebrow"><span class="eyebrow-line"></span> ONLINE MODE</div>
          <h1>Bring a friend<span>.</span></h1>
          <p>One room code is all it takes.</p>
        </div>
        <div class="online-options">
          <div class="online-panel">
            <span class="panel-number">01</span>
            <h2>Start a room</h2>
            <p>We'll make a room and give you a code to share.</p>
            <button class="primary-button" :disabled="roomBusy || !firebaseConfigured" @click="game.createOnlineRoom()">
              {{ roomBusy ? 'CREATING…' : 'CREATE ROOM' }} <span>↗</span>
            </button>
          </div>
          <div class="panel-or">OR</div>
          <form class="online-panel" @submit.prevent="submitJoin">
            <span class="panel-number">02</span>
            <h2>Join a room</h2>
            <p>Already have a code? Jump right in.</p>
            <label class="sr-only" for="room-code">Room code</label>
            <input id="room-code" v-model="joinCode" maxlength="8" autocomplete="off" placeholder="ENTER ROOM CODE" />
            <button class="primary-button" :disabled="roomBusy || joinCode.length < 8" type="submit">
              {{ roomBusy ? 'JOINING…' : 'JOIN ROOM' }} <span>↗</span>
            </button>
          </form>
        </div>
        <p v-if="!firebaseConfigured" class="setup-note">Online play needs Firebase setup. See the README to get started.</p>
        <p v-if="roomError" class="error-message" role="alert">{{ roomError }}</p>
      </template>
      <template v-else>
        <div class="game-heading">
          <div class="eyebrow"><span class="eyebrow-line"></span> ONLINE MODE · {{ roomSession.mark }} PLAYER</div>
          <h1>Friendship<span>.</span><br />on the line.</h1>
        </div>
        <div v-if="lastCreatedCode" class="room-code-banner">
          <div><span class="code-label">YOUR ROOM CODE</span><strong>{{ lastCreatedCode }}</strong></div>
          <button class="copy-button" @click="copyCode">{{ copied ? 'COPIED!' : 'COPY CODE' }} <span>{{ copied ? '✓' : '↗' }}</span></button>
        </div>
        <div v-else class="room-code-banner joined-banner"><div><span class="code-label">ROOM CODE</span><strong>{{ roomSession.code }}</strong></div><span class="you-are">YOU ARE {{ roomSession.mark }}</span></div>
        <div class="matchup"><span class="match-player"><i class="mark-x">×</i> PLAYER X</span><span class="match-divider">VS</span><span class="match-player">PLAYER O <i class="mark-o">○</i></span></div>
        <div class="status-pill" :class="{ 'status-win': room?.status === 'finished' }"><span class="status-dot"></span>{{ onlineStatus }}</div>
        <div class="board" role="grid" aria-label="Online Tic-Tac-Toe board">
          <button
            v-for="(cell, index) in displayBoard"
            :key="index"
            class="cell"
            :class="[`cell-${cell.toLowerCase()}`, { 'cell-disabled': !canPlay || cell }]"
            :disabled="!canPlay || Boolean(cell)"
            :aria-label="`Row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}${cell ? `, ${cell}` : ', empty'}`"
            role="gridcell"
            @click="clickCell(index)"
          >{{ cell === 'X' ? '×' : cell === 'O' ? '○' : '' }}</button>
        </div>
        <button v-if="room?.status === 'finished'" class="subtle-button" @click="newGame()">PLAY AGAIN <span>↻</span></button>
        <p v-if="roomError" class="error-message" role="alert">{{ roomError }}</p>
      </template>
    </section>

    <footer class="site-footer"><span>© 2026 TIC.TAC.TOE</span><span>THINK FAST. HAVE FUN.</span></footer>
  </main>
</template>
