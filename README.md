# ChessTeaching_BackEnd
### 기능 정리
주소|방식|설명
---|---|---|
/start|POST|사용자의 색상을 받아 게임을 시작하고 보드판을 보냅니다. 이때 사용자가 흑색이면 인공지능이 한 수를 둔 다음 보냅니다.
/ask|POST|fen이라는 체스의 현재 상태를 나타내는 문자열을 받아 이에 맞는 현재 사용자가 어떤 수가 두면 좋은지 알려줍니다.
/move|POST|사용자의 수(ex:e2e4)를 받아 보드에 반영하고 인공지능이 수를 둔 다음 현재 보드 상황과 여태 기보 기록을 반환합니다.
/skip|GET|룰렛에서 헌눈 팔기가 나온 경우, 사용자의 턴을 넘기고 인공지능이 수를 둔 현재 보드 상황과 여태 기보 기록을 반환합니다.
/analyzes|GET|여태 기보를 바탕으로 분석한 뒤 WebSocket을 통해 실시간으로 조언을 줍니다.
/answer|POST|사용자의 질문을 받아 대화형 챗봇에게 전달하여 WebSocket을 통해 실시간으로 답변을 합니다.

[FrontEnd 주소입니다.](https://github.com/goshin1/ChessTeaching_Front)
