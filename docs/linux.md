# Linux 실행 및 배포

문제해결과인공지능 · 이다은 · 허서연 · 윤태현 · 홍유석

완성된 v2 모델과 웹 라이브러리를 `dist/`에 포함했습니다. 웹앱 실행에는 npm 설치, 학습 데이터 압축 해제, AI API 키가 필요 없습니다. 사진 분석은 접속한 기기의 브라우저에서 수행됩니다.

## 내 Linux에서 실행

Python 3.10 이상이 설치된 Linux에서 프로젝트 디렉터리로 이동해 실행합니다.

```bash
bash start-linux.sh 8000
```

브라우저에서 http://localhost:8000 을 엽니다. 서버는 `127.0.0.1`에만 바인딩합니다. 종료하려면 Ctrl+C를 누릅니다. 다른 포트를 사용하려면 마지막 숫자를 바꿉니다.

원격 Linux에서 이 명령을 실행했다면 내 컴퓨터에서 SSH 포트 전달로 접속할 수 있습니다. 아래의 사용자와 서버 주소를 실제 값으로 바꿉니다.

```bash
ssh -L 8000:127.0.0.1:8000 username@SERVER_IP
```

그다음 내 컴퓨터의 http://localhost:8000 을 엽니다. SSH 연결을 유지하는 동안 접속할 수 있습니다.

## Nginx로 계속 운영

상시 웹 서버에는 `dist/`만 웹 루트로 지정합니다. Python 서버를 함께 실행할 필요가 없습니다. 학습 자료나 Git 저장소 전체를 웹 루트로 지정하지 마세요.

GitHub용 ZIP을 받았다면 먼저 압축을 해제한 프로젝트 디렉터리에서 아래 명령으로 배포할 파일을 복사합니다. `/opt/parking-four-linux-v2`가 아직 없는 새 설치용 명령입니다.

```bash
sudo mkdir /opt/parking-four-linux-v2
sudo cp -a dist deployment /opt/parking-four-linux-v2/
```

그다음 아래 절차에서 Nginx를 설치하고, 별도 Linux용 tar.gz 압축 해제 단계는 건너뛰어 `nginx.conf` 복사부터 진행합니다.

Ubuntu/Debian 계열 새 서버에서 Nginx가 없다면 설치합니다. 다른 배포판은 해당 패키지 관리자로 Nginx를 설치합니다.

```bash
sudo apt update
sudo apt install nginx
```

`parking-four-linux-v2.tar.gz`를 서버로 옮긴 다음 아래 명령으로 설치합니다. 기존 설치나 `parking-four.conf`가 있다면 별도 경로에 압축을 풀고 설정의 `root`를 조정합니다.

```bash
sudo tar -xzf parking-four-linux-v2.tar.gz -C /opt
sudo cp /opt/parking-four-linux-v2/deployment/nginx.conf /etc/nginx/conf.d/parking-four.conf
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

제공한 설정은 `/opt/parking-four-linux-v2/dist`를 8080 포트로 제공합니다. 서버 방화벽과 클라우드 보안 그룹에서 해당 포트가 허용돼야 외부에서 `http://SERVER_IP:8080`으로 접속할 수 있습니다. 이미 8080을 쓰는 서비스가 있다면 설정의 `listen` 값을 조정합니다.

이 Nginx 예제에는 로그인 기능이 없습니다. 기존 ChatGPT 사이트의 소유자 접근 설정은 다른 서버로 이전되지 않습니다. 제한된 접속이 필요하면 SSH 포트 전달 방식을 사용하거나 서버의 접근 제어를 구성합니다. 도메인을 연결할 때는 해당 서버에서 HTTPS 인증서를 설정합니다.

## 배포 확인

```bash
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/inference-worker.js
curl -I http://127.0.0.1:8080/models/parking/weights.bin
```

세 요청이 200을 반환하고 JavaScript가 JavaScript MIME으로 제공되는지 확인합니다. 브라우저에서 **예제로 체험**을 누르면 공개 PKLot 사진의28개 주차칸을 기존 모델로 실제 분석합니다. 이 환경의 확인 결과는 확인된 차량3대·빈자리24칸·확인 필요1칸이며, 화면에는 확인 필요 칸을 포함한3~4대 범위를 함께 표시합니다. 결과는 하드코딩하지 않았습니다. 직접 찍은 사진은 **사진 촬영·선택 → 주차칸 지정 또는 프로필 불러오기 → 영역 확인 → 차량 수 확인하기** 순서로 사용합니다. 한 칸에 차량 한 대, 지정한 영역 안만 집계한다는 범위를 유지합니다.

Nginx 설정은 공식 정적 파일 제공 문서에 맞춰 작성했습니다: https://nginx.org/en/docs/beginners_guide.html#static

## 구성

- `dist/`: 웹 화면, 학습된 v2 모델, Worker, 예제, 모델 다운로드 ZIP
- `serve.py`, `start-linux.sh`: 로컬 확인용 실행 파일
- `deployment/nginx.conf`: Linux 상시 운영용 설정 예제
- `DATA_LICENSE.md`, `THIRD_PARTY_NOTICES.md`: 데이터·라이브러리 출처

별도로 제공한 Linux용 tar.gz는 추론용 묶음입니다. 현재 GitHub용 전체 프로젝트에는 `training/`과 `artifacts/`에 재학습용 원본·도구도 포함돼 있습니다. 새 차량 수 집계 화면은 기존 v2 모델을 그대로 사용합니다.
