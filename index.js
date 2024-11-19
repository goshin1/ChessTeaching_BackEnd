const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

const stockfish = spawn('./stockfish/stockfish-windows-x86-64-avx2.exe'); // Stockfish 경로 설정

// Stockfish 출력 처리
stockfish.stdout.on('data', (data) => {
  // console.log(Stockfish: ${data});
});

stockfish.stderr.on('data', (data) => {
  console.error(`Error: ${data}`);
});

let currentPosition = ''; // 현재 보드 상태 저장
let playerColor = ''; // 사용자 색상 저장
let movesHistory = []; // 게임 진행 상황을 저장
let fenHistory = '';
let checkmate = '';

// 보드 상태를 배열 형식으로 변환
function convertStockfishBoard(stockfishBoard) {
  const lines = stockfishBoard.trim().split('\n');
  const board = [];

  lines.forEach((line) => {
    if (line.startsWith(" |")) {
      let elements = line.substr(1).split('|').map(item => item.trim()).slice(1);
      const row = elements.map(item => item === '' ? '.' : item).filter(item => isNaN(item));
      board.push(row);
    }
  });

  return board;
}

function convertFen(stockfishBoard) {
  const lines = stockfishBoard.trim().split('\n');
  lines.forEach((line) => {
    if (line.indexOf("Fen: ") !== -1) {
      if(fenHistory === line.slice("Fen: ".length, line.length)){
        return "fail";
      }
      fenHistory = line.slice("Fen: ".length, line.length);
    }
    if(line.indexOf("Checkers: ") !== -1){
      checkmate = line.slice("Checkers: ".length, line.length)
    }
  });
  return "sucess";
}


// 게임 시작 엔드포인트
app.post('/start', (req, res) => {
  const { color } = req.body;
  playerColor = color;  // 사용자 색상 저장

  // 초기화 명령어
  stockfish.stdin.write('uci\n');
  stockfish.stdin.write("setoption name MultiPV value 10\n"); // 최적의 한 수만 계산
  stockfish.stdin.write("position startpos moves\n");
  currentPosition = '';  // 게임 시작 시 초기화
  movesHistory = [];  // 게임 기록 초기화

  let responseSent = false;  // 응답 상태 체크 변수

  // 사용자 색상에 따라 게임 설정
  if (color === 'black') {
    // 흑색이 먼저 시작하도록 AI가 첫 수를 둡니다.
    stockfish.stdin.write('go movetime 1000\n'); // AI가 첫 수를 두도록
    stockfish.stdout.on('data', (data) => {
      const response = data.toString();
      const moveMatch = response.match(/bestmove (\S+)/);
      if (moveMatch && !responseSent) {
        const aiMove = moveMatch[1];
        currentPosition = aiMove; // AI의 첫 수를 반영
        movesHistory.push(aiMove); // 첫 번째 AI 수 기록

        // FEN 상태와 AI의 첫 수를 반영한 명령어
        stockfish.stdin.write(`position startpos moves ${movesHistory.join(' ')}\n`);
        stockfish.stdin.write('d\n'); // 초기 보드 상태 출력 요청

        stockfish.stdout.on('data', (data) => {
          if (!responseSent) {
            responseSent = true;  // 응답을 보냈음을 표시
            console.log("== 사용자 시작 ==");
            console.log(data.toString());
            convertFen(data.toString())
            return res.send({
              move: movesHistory,
              message: `Game started with ${color} color.`,
              board: convertStockfishBoard(data.toString())
            });
          }
        });
      }
    });
  } else {
    // 흰색은 사용자 수를 기다립니다.
    stockfish.stdin.write('d\n'); // 초기 보드 상태 출력 요청

    stockfish.stdout.on('data', (data) => {
        console.log("== 사용자 시작 ==");
        console.log(data.toString());
        if(data.toString().indexOf("+") !== -1){
          if (!responseSent) {
            responseSent = true;  // 응답을 보냈음을 표시
            convertFen(data.toString())
            return res.send({
              message: `Game started with ${color} color.`,
              board: convertStockfishBoard(data.toString())
            });
          }
        }
    });
  }
});

app.post("/ask", (req, res) => {
  const { fen } = req.body;
  let responseSent = false;  // 응답 상태 체크 변수
  stockfish.stdin.write('go movetime 1000\n'); 
  stockfish.stdout.on('data', (data) => {
    const response = data.toString();
    const moveMatch = response.match(/bestmove (\S+)/);

    if (moveMatch && !responseSent) {
      const aiMove = moveMatch[1];  // AI가 계산한 최적의 수
      if (!responseSent) {
        responseSent = true;  // 응답을 보냈음을 표시
       
        return res.send({
          answer : aiMove
        });
      }
    }
  });

})

// 이동 처리 엔드포인트
app.post('/move', (req, res) => {
  const { move } = req.body;

  // 사용자 수를 currentPosition에 반영 (게임의 진행 상황을 추적)
  movesHistory.push(move); // 사용자의 이동 기록

  let responseSent = false;  // 응답 상태 체크 변수

  // 1. 사용자의 수를 보드에 반영
  stockfish.stdin.write(`position fen ${fenHistory} moves ${move}\n`); // 갱신된 보드 상태 전달
  stockfish.stdin.write("d\n");

  // 첫 번째 리스너: stockfish의 초기 응답을 처리하는 함수
  const handleStockfishData = (data) => {
    let check = null;
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      if (line.indexOf("Fen: ") !== -1) {
        check = line.slice("Fen: ".length);
      }
    });
    let checkFen = convertFen(data.toString())

    // 이동이 실패해서 그대로 인 경우
    if(checkFen === "fail"){
      return res.send({
        status : checkFen,
        checkmate : checkmate,
        fen : fenHistory,
        move: movesHistory,  // AI의 최적의 수
        board: convertStockfishBoard(data.toString())  // 갱신된 보드 상태
      });
    }

    let turnColor = checkFen.split(" ")[1];
    // 이동을 해도 체크메이트인 경우 여기서 막는다.
    if((turnColor === "b" && playerColor === 'black') || (turnColor === "w" && playerColor === 'white')){
      console.log("==== fail ====")
      return res.send({
        status : "fail",
        checkmate : checkmate,
        fen : fenHistory,
        move: movesHistory,  // AI의 최적의 수
        board: convertStockfishBoard(data.toString())  // 갱신된 보드 상태
      });
    }else{
      if(check !== null){
        console.log("사용자  fen : " + fenHistory) // 여기서는 내가 검정이면 ai가 w
        stockfish.stdin.write('go movetime 1000\n'); // AI가 계산할 시간 설정 (예: 1초)
  
        // 두 번째 리스너: AI의 최적 수를 계산하고 응답하는 함수
        const handleAiMoveData = (data) => {
          const response = data.toString();
          const moveMatch = response.match(/bestmove (\S+)/);
  
          if (moveMatch && !responseSent) {
            const aiMove = moveMatch[1];  // AI가 계산한 최적의 수
            movesHistory.push(aiMove); // AI의 수 기록
            stockfish.stdin.write(`position fen ${fenHistory} moves ${aiMove}\n`); 
            stockfish.stdin.write('d\n');  // 현재 보드 상태 출력 요청
  
            // 현재 보드 상태 출력 후, 리스너를 제거하고 응답을 보냄
            stockfish.stdout.once('data', (data) => {
              convertFen(data.toString())
              if (data.toString().indexOf("+") !== -1) {
                if (!responseSent) {
                  responseSent = true;  // 응답을 보냈음을 표시
                  console.log("인공지능 fen : " + fenHistory) // 이제 백색이 두었으니 b로 출력
                  // 응답 전송 후 리스너 제거
                  stockfish.stdout.removeListener('data', handleAiMoveData);  // AI 수 계산 리스너 제거
                  stockfish.stdout.removeListener('data', handleStockfishData);  // 첫 번째 리스너 제거
  
                  return res.send({
                    status : 'sucess',
                    checkmate : checkmate,
                    fen : fenHistory,
                    move: movesHistory,  // AI의 최적의 수
                    board: convertStockfishBoard(data.toString())  // 갱신된 보드 상태
                  });
                }
              }
            });
          }
        };
        // 'data' 이벤트 리스너를 등록하여 AI의 최적 수를 계산하는 리스너를 처리합니다.
        stockfish.stdout.on('data', handleAiMoveData);
      }
    }
  };
  
  // 첫 번째 리스너 등록: stockfish의 출력 데이터를 처리
  stockfish.stdout.once('data', handleStockfishData);
});



// 서버 시작
app.listen(port, () => {
  console.log( `Server is running on http://localhost:${port}`);
}); 