<template>
  <div
    class="emoji-picker"
    v-if="isVisible"
    @mouseenter="$emit('mouse-enter')"
    @mouseleave="$emit('mouse-leave')"
  >
    <button class="close-btn mobile-only" @click="$emit('close')">
      <i class="fas fa-times"></i>
    </button>

    <div class="emoji-categories">
      <button
        v-for="category in categories"
        :key="category.name"
        @click="activeCategory = category.name"
        :class="{ active: activeCategory === category.name }"
        class="category-btn"
        type="button"
      >
        {{ category.icon }}
      </button>
    </div>

    <div class="emoji-grid">
      <button
        v-for="emoji in currentEmojis"
        :key="emoji"
        @click="selectEmoji(emoji)"
        class="emoji-btn"
        type="button"
      >
        {{ emoji }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'EmojiPicker',
  props: {
    isVisible: {
      type: Boolean,
      default: false
    }
  },
  emits: ['emoji-selected', 'mouse-enter', 'mouse-leave', 'close'],
  data() {
    return {
      activeCategory: 'smileys',
      categories: [
        {
          name: 'smileys',
          icon: '😀',
          emojis: [
            '😀',
            '😃',
            '😄',
            '😁',
            '😆',
            '😅',
            '😂',
            '🤣',
            '😊',
            '😇',
            '🙂',
            '🙃',
            '😉',
            '😌',
            '😍',
            '🥰',
            '😘',
            '😗',
            '😙',
            '😚',
            '😋',
            '😛',
            '😝',
            '😜',
            '🤪',
            '🤨',
            '🧐',
            '🤓',
            '😎',
            '🤩',
            '🥳'
          ]
        },
        {
          name: 'emotions',
          icon: '😢',
          emojis: [
            '😥',
            '😢',
            '😭',
            '😤',
            '😠',
            '😡',
            '🤬',
            '🤯',
            '😳',
            '🥵',
            '🥶',
            '😱',
            '😨',
            '😰',
            '😥',
            '😓',
            '🤗',
            '🤔',
            '🤭',
            '🤫',
            '🤥',
            '😶',
            '😐',
            '😑',
            '😬',
            '🙄',
            '😯',
            '😦',
            '😧',
            '😮',
            '😲'
          ]
        },
        {
          name: 'gestures',
          icon: '👍',
          emojis: [
            '👍',
            '👎',
            '👌',
            '🤌',
            '🤏',
            '✌️',
            '🤞',
            '🤟',
            '🤘',
            '🤙',
            '👈',
            '👉',
            '👆',
            '🖕',
            '👇',
            '☝️',
            '👏',
            '🙌',
            '👐',
            '🤲',
            '🤝',
            '🙏',
            '✍️',
            '💪',
            '🦾',
            '🦿',
            '🦵',
            '🦶',
            '👂',
            '🦻',
            '👃'
          ]
        },
        {
          name: 'hearts',
          icon: '❤️',
          emojis: [
            '❤️',
            '🧡',
            '💛',
            '💚',
            '💙',
            '💜',
            '🤎',
            '🖤',
            '🤍',
            '💔',
            '❣️',
            '💕',
            '💞',
            '💓',
            '💗',
            '💖',
            '💘',
            '💝',
            '💟',
            '♥️',
            '💯',
            '💢',
            '💥',
            '💫',
            '💦',
            '💨',
            '🕳️',
            '💣',
            '💬',
            '👁️‍🗨️',
            '🗨️'
          ]
        },
        {
          name: 'objects',
          icon: '🎉',
          emojis: [
            '🎉',
            '🎊',
            '🎈',
            '🎁',
            '🎀',
            '🎂',
            '🍰',
            '🧁',
            '🍭',
            '🍬',
            '🍫',
            '🍩',
            '🍪',
            '🍕',
            '🍔',
            '🍟',
            '🌭',
            '🥪',
            '🌮',
            '🌯',
            '🥙',
            '🥚',
            '🍳',
            '🥘',
            '🍲',
            '🥗',
            '🍿',
            '🧈',
            '🧀',
            '🥨',
            '🥯'
          ]
        }
      ]
    }
  },
  computed: {
    currentEmojis() {
      const category = this.categories.find((cat) => cat.name === this.activeCategory)
      return category ? category.emojis : []
    }
  },
  methods: {
    selectEmoji(emoji) {
      this.$emit('emoji-selected', emoji)
    }
  }
}
</script>

<style scoped>
.emoji-picker {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 0.5rem;
  padding: 0.75rem;
  z-index: 99999;
  width: 280px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  margin-bottom: 0.5rem;
}

.close-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 0.875rem;
  transition: color 0.2s;
  z-index: 10000;
}

.close-btn:hover {
  color: #fff;
}

.mobile-only {
  display: none;
}

@media (max-width: 768px) {
  .mobile-only {
    display: block;
  }

  .emoji-picker {
    width: 260px;
    padding-top: 2rem;
  }
}

.emoji-categories {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #444;
}

.category-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.category-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.category-btn.active {
  background: rgba(76, 175, 80, 0.2);
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0.25rem;
  max-height: 200px;
  overflow-y: auto;
}

.emoji-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  padding: 0.5rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.emoji-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.emoji-grid::-webkit-scrollbar {
  width: 4px;
}

.emoji-grid::-webkit-scrollbar-track {
  background: #333;
  border-radius: 2px;
}

.emoji-grid::-webkit-scrollbar-thumb {
  background: #666;
  border-radius: 2px;
}

.emoji-grid::-webkit-scrollbar-thumb:hover {
  background: #777;
}
</style>
