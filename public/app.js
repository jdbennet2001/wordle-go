(function () {
  const WORD_LENGTH = 5;
  const MAX_GUESSES = 6;
  const KEY_ROWS = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"]
  ];

  let words = [];
  let wordSet = new Set();
  let answer = "";
  let guesses = Array.from({ length: MAX_GUESSES }, () => "");
  let evaluatedRows = [];
  let currentRow = 0;
  let gameOver = false;
  let keyState = {};

  const $board = $("#board");
  const $keyboard = $("#keyboard");
  const $status = $("#status-text");
  const $shareBtn = $("#share-btn");

  function getDailyWord(list) {
    const now = new Date();
    const daySeed = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
    return list[daySeed % list.length];
  }

  function getRandomWord(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function setStatus(text) {
    $status.text(text);
  }

  function setShareEnabled(enabled) {
    $shareBtn.prop("disabled", !enabled);
  }

  function getPuzzleNumber() {
    const now = new Date();
    return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
  }

  function buildShareText() {
    const solved = gameOver && guesses[currentRow] && guesses[currentRow].toLowerCase() === answer;
    const score = solved ? String(currentRow + 1) : "X";
    const title = `Wordle Go ${getPuzzleNumber()} ${score}/${MAX_GUESSES}`;
    const iconByState = { hit: "🟩", near: "🟨", miss: "⬛" };
    const rows = evaluatedRows.map((row) => row.map((state) => iconByState[state]).join(""));
    return `${title}\n\n${rows.join("\n")}`;
  }

  async function copyShareResult() {
    if (!gameOver || evaluatedRows.length === 0) {
      setStatus("Finish the puzzle to share your result.");
      return;
    }

    const shareText = buildShareText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        const $temp = $("<textarea></textarea>").val(shareText).appendTo("body");
        $temp.trigger("focus").trigger("select");
        document.execCommand("copy");
        $temp.remove();
      }
      setStatus("Result copied to clipboard.");
    } catch (error) {
      setStatus("Could not copy result on this device.");
    }
  }

  function buildBoard() {
    $board.empty();
    for (let r = 0; r < MAX_GUESSES; r += 1) {
      const $row = $('<div class="board-row"></div>').attr("data-row", r);
      for (let c = 0; c < WORD_LENGTH; c += 1) {
        const $tile = $('<div class="tile"></div>').attr({ "data-row": r, "data-col": c });
        $row.append($tile);
      }
      $board.append($row);
    }
  }

  function buildKeyboard() {
    $keyboard.empty();
    KEY_ROWS.forEach((row, rowIdx) => {
      const $row = $('<div class="key-row"></div>').addClass(`row-${rowIdx + 1}`);
      row.forEach((key) => {
        const label = key === "BACK" ? "⌫" : key;
        const $key = $("<button></button>")
          .addClass("key")
          .attr({ type: "button", "data-key": key })
          .text(label);
        $row.append($key);
      });
      $keyboard.append($row);
    });
  }

  function paintRow(rowIndex, result) {
    result.forEach((state, idx) => {
      const $tile = $(`.tile[data-row='${rowIndex}'][data-col='${idx}']`);
      setTimeout(() => {
        $tile.addClass("flip");
        setTimeout(() => {
          $tile.removeClass("flip").addClass(state);
        }, 110);
      }, idx * 120);
    });
  }

  function updateKeyState(letter, state) {
    const rank = { miss: 1, near: 2, hit: 3 };
    const existing = keyState[letter];
    if (!existing || rank[state] > rank[existing]) {
      keyState[letter] = state;
      $(`.key[data-key='${letter}']`).removeClass("miss near hit").addClass(state);
    }
  }

  function evaluateGuess(guess, target) {
    const result = Array(WORD_LENGTH).fill("miss");
    const letters = target.split("");

    for (let i = 0; i < WORD_LENGTH; i += 1) {
      if (guess[i] === letters[i]) {
        result[i] = "hit";
        letters[i] = "*";
      }
    }

    for (let i = 0; i < WORD_LENGTH; i += 1) {
      if (result[i] === "hit") {
        continue;
      }
      const idx = letters.indexOf(guess[i]);
      if (idx !== -1) {
        result[i] = "near";
        letters[idx] = "*";
      }
    }

    return result;
  }

  function syncBoard() {
    for (let r = 0; r < MAX_GUESSES; r += 1) {
      const guess = guesses[r];
      for (let c = 0; c < WORD_LENGTH; c += 1) {
        const $tile = $(`.tile[data-row='${r}'][data-col='${c}']`);
        const ch = guess[c] || "";
        $tile.text(ch);
        $tile.toggleClass("filled", Boolean(ch));
      }
    }
  }

  function onSubmitGuess() {
    if (gameOver) {
      return;
    }

    const guess = guesses[currentRow].toLowerCase();
    if (guess.length !== WORD_LENGTH) {
      setStatus("Not enough letters.");
      return;
    }

    if (!wordSet.has(guess)) {
      setStatus("Not in word list.");
      return;
    }

    const result = evaluateGuess(guess, answer);
    evaluatedRows[currentRow] = result;
    paintRow(currentRow, result);
    guess.toUpperCase().split("").forEach((ch, i) => updateKeyState(ch, result[i]));

    if (guess === answer) {
      gameOver = true;
      setShareEnabled(true);
      setStatus(`You solved it in ${currentRow + 1} guess${currentRow === 0 ? "" : "es"}!`);
      return;
    }

    currentRow += 1;

    if (currentRow >= MAX_GUESSES) {
      gameOver = true;
      setShareEnabled(true);
      setStatus(`Game over. The word was ${answer.toUpperCase()}.`);
      return;
    }

    setStatus(`Guess ${currentRow + 1} of ${MAX_GUESSES}`);
  }

  function onBackspace() {
    if (gameOver) {
      return;
    }

    guesses[currentRow] = guesses[currentRow].slice(0, -1);
    syncBoard();
  }

  function onLetter(letter) {
    if (gameOver) {
      return;
    }

    if (guesses[currentRow].length >= WORD_LENGTH) {
      return;
    }

    guesses[currentRow] += letter;
    syncBoard();
  }

  function handleInput(rawKey) {
    const key = rawKey.toUpperCase();
    if (key === "ENTER") {
      onSubmitGuess();
      return;
    }
    if (key === "BACKSPACE" || key === "BACK") {
      onBackspace();
      return;
    }
    if (/^[A-Z]$/.test(key)) {
      onLetter(key);
    }
  }

  function resetGame(useDailyWord) {
    guesses = Array.from({ length: MAX_GUESSES }, () => "");
    evaluatedRows = [];
    currentRow = 0;
    gameOver = false;
    keyState = {};
    setShareEnabled(false);
    $(".key").removeClass("miss near hit");
    $(".tile").removeClass("filled miss near hit flip").text("");
    answer = useDailyWord ? getDailyWord(words) : getRandomWord(words);
    setStatus(`Guess 1 of ${MAX_GUESSES}`);
    syncBoard();
  }

  function initEvents() {
    $(document).on("keydown", (event) => {
      const key = event.key;
      if (/^[a-zA-Z]$/.test(key) || key === "Enter" || key === "Backspace") {
        event.preventDefault();
      }
      handleInput(key);
    });

    $keyboard.on("click", ".key", function () {
      const key = $(this).data("key");
      handleInput(key);
    });

    $("#new-game-btn").on("click", () => {
      resetGame(false);
      setStatus("New random puzzle started.");
    });

    $shareBtn.on("click", () => {
      copyShareResult();
    });
  }

  function loadWords() {
    return $.getJSON("/words.json").then((data) => {
      words = (data || [])
        .filter((w) => typeof w === "string")
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length === WORD_LENGTH);

      wordSet = new Set(words);

      if (words.length === 0) {
        throw new Error("No usable words were found.");
      }
    });
  }

  $(function () {
    buildBoard();
    buildKeyboard();
    initEvents();

    loadWords()
      .then(() => {
        resetGame(true);
        setStatus(`Daily puzzle ready. Guess 1 of ${MAX_GUESSES}`);
      })
      .catch((error) => {
        gameOver = true;
        setStatus(`Failed to load words: ${error.message}`);
      });
  });
})();
