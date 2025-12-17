
export interface BingoTheme {
    id: string;
    name: string;
    colors: {
        background: string;
        cardBg: string;
        headerBg: string;
        headerText: string;
        cellBg: string;
        cellText: string;
        markedBg: string;
        markedText: string;
        uncalledBg: string;
        uncalledText: string;
        callableBg: string;
        freeBg: string;
        freeText: string;
        border: string;
        accent: string;
    };
}

export const BINGO_THEMES: Record<string, BingoTheme> = {
    modern: {
        id: 'modern',
        name: 'Modern Dark',
        colors: {
            background: '#0a0a1a',
            cardBg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            headerBg: 'linear-gradient(135deg, #e94560 0%, #ff6b6b 100%)',
            headerText: '#ffffff',
            cellBg: '#0f3460',
            cellText: '#eeeeee',
            markedBg: 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)',
            markedText: '#ffffff',
            uncalledBg: '#0a0a1a',
            uncalledText: '#555555',
            callableBg: '#1a4a7a',
            freeBg: 'linear-gradient(135deg, #fdcb6e 0%, #f39c12 100%)',
            freeText: '#1a1a2e',
            border: '#0f3460',
            accent: '#e94560'
        }
    },
    classic: {
        id: 'classic',
        name: 'Classic White',
        colors: {
            background: '#f5f5f5',
            cardBg: '#ffffff',
            headerBg: '#2c3e50',
            headerText: '#ffffff',
            cellBg: '#ffffff',
            cellText: '#2c3e50',
            markedBg: '#e74c3c',
            markedText: '#ffffff',
            uncalledBg: '#f9f9f9',
            uncalledText: '#bdc3c7',
            callableBg: '#3498db',
            freeBg: '#f1c40f',
            freeText: '#2c3e50',
            border: '#dcdde1',
            accent: '#2980b9'
        }
    },
    neon: {
        id: 'neon',
        name: 'Cyber Neon',
        colors: {
            background: '#000000',
            cardBg: '#111111',
            headerBg: 'linear-gradient(135deg, #ff00ff 0%, #bc13fe 100%)',
            headerText: '#ffffff',
            cellBg: '#1a1a1a',
            cellText: '#00ff00',
            markedBg: '#00ffff',
            markedText: '#000000',
            uncalledBg: '#050505',
            uncalledText: '#333333',
            callableBg: '#222222',
            freeBg: '#ffff00',
            freeText: '#000000',
            border: '#00ff00',
            accent: '#ff00ff'
        }
    },
    christmas: {
        id: 'christmas',
        name: 'Christmas Spirit',
        colors: {
            background: '#053305',
            cardBg: '#ffffff',
            headerBg: '#c0392b',
            headerText: '#ffffff',
            cellBg: '#ffffff',
            cellText: '#27ae60',
            markedBg: '#2ecc71',
            markedText: '#ffffff',
            uncalledBg: '#f0f0f0',
            uncalledText: '#bdc3c7',
            callableBg: '#e67e22',
            freeBg: '#f1c40f',
            freeText: '#c0392b',
            border: '#c0392b',
            accent: '#c0392b'
        }
    },
    gold: {
        id: 'gold',
        name: 'Luxury Gold',
        colors: {
            background: '#1a1a1a',
            cardBg: 'linear-gradient(135deg, #2c2c2c 0%, #000000 100%)',
            headerBg: 'linear-gradient(135deg, #d4af37 0%, #f9d71c 100%)',
            headerText: '#000000',
            cellBg: '#1a1a1a',
            cellText: '#d4af37',
            markedBg: '#d4af37',
            markedText: '#000000',
            uncalledBg: '#111111',
            uncalledText: '#444444',
            callableBg: '#333333',
            freeBg: '#ffffff',
            freeText: '#000000',
            border: '#d4af37',
            accent: '#d4af37'
        }
    }
};

export const DEFAULT_THEME = BINGO_THEMES.modern;
