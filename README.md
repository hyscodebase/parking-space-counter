# 빈자리 — 주차칸 AI 안내 v2

**문제해결과인공지능** 팀 프로젝트 · **이다은 · 허서연 · 윤태현 · 홍유석**

고정 시점 주차장 사진의 A1~A4를 지정하고, Teachable Machine 이미지 모델로 각 칸을 빈자리·사용 중·확인 필요로 안내하는 웹 시제품입니다.

[배포 사이트](https://parking-four-yuseok.hyscodebase.chatgpt.site/)는 현재 소유자 ChatGPT 로그인이 필요합니다. 저장소만으로 로컬 실행과 학습·평가 재현이 가능합니다.

이 프로젝트 ZIP을 받았다면 압축을 해제한 뒤 [GitHub 업로드 안내](GITHUB_UPLOAD.md)에 따라 내부 파일을 저장소에 올립니다.

## 웹앱 실행

Linux 실행과 Nginx 배포는 [Linux 배포 안내](docs/linux.md)를 참고하세요.

```bash
python serve.py
```

http://localhost:8000 에서 **기본 모델로 시작 → 실제 주차장 예제로 체험 → 네 칸 확인 → 네 칸 분석하기** 순서로 사용합니다. 직접 촬영한 JPG·PNG·WebP(20MB 이하)도 업로드할 수 있습니다. `dist/index.html`을 파일로 직접 열면 ES 모듈 보안 제한으로 실행되지 않습니다.

웹앱 실행에 npm 설치나 서버 AI API 키는 필요 없습니다. 기본 모델과 라이브러리를 함께 제공합니다. 사진은 서버에 업로드하지 않고 브라우저에서 처리합니다.

## 티처블 머신에서 열어보기

`training/parking-v2-training-source.tm`을 [티처블 머신](https://teachablemachine.withgoogle.com/train/image)의 **Open project from file** 메뉴에서 엽니다. **Train Model**을 누르고 학습이 끝나면 미리보기에서 사진으로 확인합니다.

이 `.tm` 파일은 빈자리228장·사용 중228장과 학습 설정을 담은 **학습 전 원본 프로젝트**입니다. 사이트에 포함한 완성 모델과는 별개이며 웹에서 다시 학습해야 합니다. [파일 선택과 확인 방법](docs/teachable-machine.md)에 자세히 설명했습니다.

## 주요 기능

- 4칸 영역 드래그·숫자 입력·설정 파일과 주차장 프로필 저장
- 동일 영역 중복 차단, 큰 겹침 경고
- 기본 모델·외부 Teachable Machine URL·로컬 모델 파일 연결
- 단색·암전·과노출 입력의 추론 생략과 확인 필요 표시
- 기본 모델의 Web Worker CPU 추론, 진행 상태·취소·재시도
- 사진 SHA256 기준 평가 중복 방지, 분석 시각·모델 해시·영역·판정 기준 포함 JSON/CSV
- 흑백 디자인, 320px·390px 반응형 화면

품질 검사는 주차장 사진인지 의미적으로 판단하는 기능이 아닙니다. 낮은 세부 정보/흐림은 경고만 표시합니다. 80% 예측 확률이 실제 정확도를 보장하지 않습니다.

## 모델과 평가

공식 `@teachablemachine/image@0.8.3` 라이브러리로 MobileNetV2 0.35 기반 모델을 Node CPU에서 학습했습니다. 웹 학습 화면이 멈춰 공식 라이브러리를 직접 실행했으며, 웹 UI 학습 완료로 표현하지 않습니다.

학습 입력456장(클래스별228장), 내부 가중치 학습386장·내부 검증70장입니다. 각 클래스는 맑음100·흐림100·비28장입니다. 날짜 단위로 분리한 외부 검증150장과 시험150장은 학습에 쓰지 않았습니다.

| 평가 | 결과 |
| --- | --- |
| 개별 칸 외부 검증 |149/150 정답 ·99.33%|
| 개별 칸 시험 |150/150 정답 ·100%|
| 실제 전체사진30장 |120/120칸 정답, 빈자리 수30/30 일치|
| 미학습 카메라·주차장10장 |37/40칸 정답 ·92.5%, 빈자리 수8/10 일치|

이 표본들에서 차량을 빈자리로 안내한 오류는0건이었습니다. 전체사진30장은 UFPR04의3개 촬영일에서 빈자리0~4개 상황을 각각6장씩 뽑은 작은 조건별 시험입니다. 미학습 시점10장도 작은 스트레스 시험이며 실제 발생 비율을 대표하지 않습니다. 야간, 사용자의 현장 주차장, 실제 iPhone/Android 기기는 별도 검증이 필요합니다.

기존 모델과 같은 시험자료의 정확도는 같았습니다. v2의 개선은 날씨 데이터의 클래스 균형 보강과 실제 전체사진 검증·입력/기록/사용성 개선이며 정확도 상승을 주장하지 않습니다. 이전 버전에서 관찰한 일부 시험 날짜가 포함되므로 후속 튜닝에는 새 최종 시험셋이 필요합니다.

자세한 결과는 `dist/model-report.html`, `training/improvements-data/evaluation-summary.json`, 모델 카드는 `dist/models/parking/MODEL_CARD.md`에서 확인할 수 있습니다.

## 학습 자료와 전체사진 준비

데이터 이미지 수백 개를 개별 Git 파일로 올리는 대신 `artifacts/` ZIP 두 개로 보관합니다. 아래 명령은 SHA256을 확인한 후 저장소 안에만 압축을 풉니다.

```bash
python tools/unpack_artifacts.py
python -m pip install -r training/requirements.txt
python training/restore-fullframe-crops.py training/improvements-data/fullframe-test
python training/restore-fullframe-crops.py training/improvements-data/unseen-view-test
npm ci --prefix training/eval-runtime
```

## 재학습·평가 재현

```bash
node training/improvements-data/train-v2.cjs training/improvements-data/dataset-v2 training/retrained-model training/tm-base-mobilenet-v2-035
node training/improvements-data/evaluate-patches.cjs dist/models/parking training/improvements-data/dataset-v2 training/local-evaluation/patches
node training/improvements-data/evaluate-fullframes.cjs dist/models/parking training/local-evaluation/fullframes training/improvements-data/fullframe-test
node training/improvements-data/evaluate-fullframes.cjs dist/models/parking training/local-evaluation/unseen training/improvements-data/unseen-view-test
```

`training/parking-v2-training-source.tm`은 티처블 머신 웹에서 다시 열 수 있는 **학습 전 원본 프로젝트456장**입니다. 완성된 추론용 모델은 `dist/models/parking/{model.json,metadata.json,weights.bin}`입니다.

학습은 CPU 속도에 따라 수분 이상 걸립니다. 패키지 버전·체크포인트·데이터·시드는 고정돼 있지만 기기/라이브러리 실행 차이로 재학습 가중치의 바이트가 항상 같다고 보장하지 않습니다.

## 테스트

```bash
npm test
python -m pip install -r tools/requirements.txt
python -m unittest discover -s tests -p 'test_*.py' -v
```

JavaScript39개와 Python14개 검사를 통과했습니다. `.github/workflows/tests.yml`은 같은 검사를 GitHub Actions에서 실행합니다. 브라우저 확인 시나리오는 `docs/browser-regression.md`에 있습니다.

## 데이터·외부 라이브러리 출처

PKLot 데이터와 사진은 CC BY4.0입니다. 자세한 원저자·변환·미러 출처는 `DATA_LICENSE.md`, 외부 코드 라이선스는 `THIRD_PARTY_NOTICES.md`를 참고하세요. 원본 앱 코드에 별도의 오픈소스 라이선스를 새로 부여하지 않았습니다.
