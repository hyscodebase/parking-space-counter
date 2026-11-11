# Linux 실행 및 배포

완성된 v2 모델과 웹 라이브러리를 `dist/`에 포함했습니다. 웹앱 실행에는 npm 설치, 학습 데이터 압축 해제, AI API 키가 필요 없습니다. 사진 분석은 접속한 기기의 브라우저에서 수행됩니다.

## 로컬 실행

Python 3.10 이상과 Git이 설치된 Linux에서 실행합니다.

```bash
git clone https://github.com/hyscodebase/parking-space-counter.git
cd parking-space-counter
bash start-linux.sh 8000
```

브라우저에서 http://localhost:8000 을 엽니다. 서버는 `127.0.0.1`에만 바인딩합니다. 종료하려면 Ctrl+C를 누릅니다. 다른 포트를 사용하려면 마지막 숫자를 바꿉니다.

원격 Linux에서 실행했다면 내 컴퓨터에서 SSH 포트 전달로 접속할 수 있습니다. 사용자와 서버 주소는 실제 값으로 바꿉니다.

```bash
ssh -L 8000:127.0.0.1:8000 username@SERVER_IP
```

SSH 연결을 유지한 상태에서 내 컴퓨터의 http://localhost:8000 을 엽니다.

## Nginx 설치 예제

아래는 **새 Ubuntu/Debian 서버**에 설치하는 예제입니다. 관리자 권한이 필요하며 시스템 설정을 변경합니다. 이미 설치 경로나 `parking-four.conf`가 있다면 덮어쓰지 말고 기존 서비스 구성을 먼저 확인하세요.

상시 웹 서버에는 `dist/`만 웹 루트로 지정합니다. Python 서버를 함께 실행할 필요는 없습니다. 저장소 전체를 웹 루트로 지정하지 마세요.

저장소 루트에서 실행합니다.

```bash
sudo apt update
sudo apt install nginx
sudo mkdir /opt/parking-four-linux-v2
sudo cp -a dist deployment /opt/parking-four-linux-v2/
sudo cp /opt/parking-four-linux-v2/deployment/nginx.conf /etc/nginx/conf.d/parking-four.conf
sudo nginx -t
```

설정 검사가 성공한 뒤 서비스를 시작·갱신합니다.

```bash
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

별도 Linux용 압축파일은 필요 없습니다. 기존 예제와의 호환성을 위해 설치 경로 `/opt/parking-four-linux-v2`와 설정 파일 이름은 유지합니다. 저장소 이름과 달라도 정상입니다.

제공 설정은 `/opt/parking-four-linux-v2/dist`를 8080 포트로 제공합니다. 이미 8080을 쓰는 서비스가 있다면 `listen`을 조정합니다. 외부 접속을 허용하려면 서버 방화벽·클라우드 보안 그룹의 접근 범위를 별도로 검토해야 합니다.

이 예제에는 로그인 기능이 없습니다. 제한된 접속이 필요하면 SSH 포트 전달이나 서버 접근 제어를 사용하고, 도메인을 연결할 때는 HTTPS 인증서를 설정합니다.

## 배포 확인

```bash
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/inference-worker.js
curl -I http://127.0.0.1:8080/models/parking/weights.bin
```

세 요청이 200을 반환하고 JavaScript가 올바른 MIME으로 제공되는지 확인합니다. 브라우저에서 **예제로 체험**을 눌러 실제 모델 추론을 확인합니다. 기존 확인 기록은 28칸에서 차량 3대·빈자리 24칸·확인 필요 1칸, 가능한 범위 3~4대입니다. 결과는 하드코딩하지 않습니다.

직접 찍은 사진은 **사진 촬영·선택 → 주차칸 지정 또는 프로필 불러오기 → 영역 확인 → 차량 수 확인하기** 순서로 사용합니다. 한 칸에 차량 한 대, 지정한 영역 안만 집계한다는 범위를 유지합니다.

- [Nginx 공식 정적 파일 제공 안내](https://nginx.org/en/docs/beginners_guide.html#static)
- [데이터 이용 조건](../DATA_LICENSE.md) · [외부 라이브러리 고지](../THIRD_PARTY_NOTICES.md)
