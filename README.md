# 차량 수 확인 — 주차칸별 AI 집계

**문제해결과인공지능** · **이다은 · 허서연 · 윤태현 · 홍유석**

[문제 해결 기록](https://github.com/hyscodebase/parking-space-counter/issues/4) · [MIT License](LICENSE)

주차장 사진에서 지정한 주차칸을 하나씩 잘라 기존 Teachable Machine 모델로 `빈자리 / 사용 중`을 판단하고, **사용 중인 칸의 수를 차량 수로 집계**하는 웹 시제품입니다. 주차칸은1~100개 지정할 수 있습니다. 사진 전체의 차량을 자동 탐지하거나 차량 수별 새 모델을 학습하는 방식은 아닙니다.

[Netlify 웹사이트](https://stunning-khapse-d705ce.netlify.app/)에 배포돼 있으며, 소스와 모델은 [GitHub 저장소](https://github.com/hyscodebase/parking-space-counter)에서 관리합니다. ZIP으로 받은 소스는 [GitHub 업로드 안내](GITHUB_UPLOAD.md)를 참고하세요. Linux 상시 운영은 [Linux 배포 안내](docs/linux.md)를 참고하세요.

Netlify에서는 저장소를 연결하면 포함된 `netlify.toml` 설정으로 `dist/`를 배포합니다. 별도 빌드 명령과 환경 변수는 필요 없습니다. Cloudflare Pages에서도 빌드 명령을 비워 두고 출력 디렉터리를 `dist`로 지정하면 됩니다. 웹 공개 경로는 `dist/`로 한정합니다.

Netlify 운영 팀과 접속 검증 기록은 [배포 안내](docs/netlify-deployment.md)를 참고하세요.

## 실행

Python3.10 이상에서 저장소 루트에 실행합니다.

```bash
python serve.py
```

http://localhost:8000 에서 확인합니다. 웹앱 실행에는 npm 설치나 빌드, AI API 키가 필요 없습니다. 기본 모델과 실행 라이브러리는 `dist/`에 포함됩니다. `dist/index.html`을 파일로 직접 열면 ES 모듈 제한으로 동작하지 않습니다.

## 사용 순서

1. **사진 촬영** 또는 **사진 선택**으로 주차장 사진을 불러옵니다.
2. 처음 사용하는 주차장은 주차칸 영역을 추가하고, 저장한 주차장은 프로필을 불러옵니다.
3. 각 영역이 서로 다른 주차칸 하나에 맞고 현재 사진과 정렬돼 있는지 확인합니다.
4. 분석하면 **차량 N대**를 표시합니다. 애매한 칸이 있으면 확인된 차량 수와 가능한 범위를 함께 표시합니다.

같은 카메라 위치에서 찍은 사진은 영역을 재사용할 수 있습니다. 촬영 위치·각도·줌·사진의 잘린 범위가 달라지면 영역을 다시 맞춥니다. 모바일 촬영 화면과 지원 형식은 기기·브라우저에 따라 다릅니다. 갤러리 사진 선택은 따로 제공하며 실시간 카메라 스트리밍은 제공하지 않습니다.

## 집계 범위

**지정한 주차칸 안의 주차 차량만 셉니다.** 한 칸에 차량 한 대가 있다는 전제이며 통로나 영역 밖 차량은 제외합니다. 한 차량이 여러 칸에 걸치거나 한 칸에 여러 차량이 있으면 이 전제가 맞지 않습니다.

사용 중7칸·빈자리2칸·확인 필요1칸이면 `확인된 차량7대`, `7~8대`로 안내합니다. 확인 필요를 임의로 빈자리나 차량으로 바꾸지 않습니다. 높은 예측 확률도 정답의 보장이 아닙니다.

구조와 한계는 [집계 방식](docs/counting-design.md), 모델 연결은 [모델 안내](docs/model-integration.md), 데이터 준비는 [학습 안내](docs/data-training.md)를 참고하세요.

## 주요 기능

- JPG·PNG·WebP 사진 선택과 모바일 촬영, 최대20MB
- 주차칸1~100개 추가·수정·삭제, 중복 영역 차단과 큰 겹침 경고
- 같은 카메라용 주차장 프로필 및 영역 JSON 저장·불러오기
- 기존 기본 모델 또는 직접 학습한 이진 Teachable Machine 모델 연결
- 224×224 주차칸 자르기, 브라우저 내 추론과 차량 수 합산
- 단색·암전·과노출 영역의 추론 생략, 낮은 확률·동률은 확인 필요 처리
- 분석 진행·취소·재시도, 분석 JSON 내보내기
- 검정·흰색 중심 반응형 화면, 부가 설정은 필요할 때 펼치는 구성

사진과 로컬 모델 파일은 앱 서버에 업로드하지 않습니다. 기본 모델은 현재 사이트에서 읽고, 외부 모델 URL을 지정한 경우에만 해당 모델 서버에 연결합니다. 프로필은 현재 브라우저에 저장됩니다.

공개 예제는 실제 PKLot 사진과 주석이 있는28개 주차칸의 위치를 불러와 **실제 모델로 추론**합니다. 정답 수량이나 고정 확률을 결과로 대신하지 않습니다.

## 기본 모델과 기존 평가

이번 집계·화면 변경에서 기존 v2 모델의 가중치는 바꾸지 않았습니다. 공식 `@teachablemachine/image@0.8.3` 라이브러리를 Node CPU에서 실행한 MobileNetV2 0.35 모델입니다. 웹 학습 화면이 응답하지 않아 실행 환경을 바꿨으며 웹 UI에서 학습·내보내기에 성공한 것으로 표현하지 않습니다.

PKLot UFPR04 주간 사진456장(빈자리228장·사용 중228장)을 학습 프로젝트에 넣었습니다. 내부 가중치 학습386장·내부 검증70장이며 외부 검증150장과 시험150장은 날짜 단위로 분리했습니다.

| 기존 v2 평가 범위 | 결과 |
| --- | --- |
| 개별 칸 외부 검증150장 |149/150 정답|
| 개별 칸 시험150장 |150/150 정답|
| 실제 전체 사진30장의 고정4칸 |120/120칸 정답, 빈자리 수30/30 일치|
| 미학습 카메라·주차장10장의 고정4칸 |37/40칸 정답, 빈자리 수8/10 일치|

이 값은 **기존 고정4칸 평가**입니다. 주차칸을100개 지정하는 기능이100칸의 정확도를 입증하지는 않습니다. 다른 현장·야간·새 카메라는 별도 검증이 필요합니다. 모델 카드·해시·출처와 상세 결과는 `dist/models/parking/`, `dist/model-report.html`에 보존합니다.

이번에는 기존에 관찰한 UFPR04 사진20장의 주석 칸559개로 영역을 넓혀 추가 진단했습니다. 칸별551/559개(98.57%)를 맞혔지만, **확인 필요 없이 차량 수까지 정확한 사진은13/20장(65%)**이었습니다. 빈 칸을 차량으로 판단한 오류3칸과 확인 필요5칸이 있어, 칸별 정확도를 전체 수량 정확도로 대신할 수 없습니다. 새로운 독립 최종 시험이 아닌 기존 사진의 확대 진단이며 미학습 카메라의 전체 칸은 이번에 평가하지 않았습니다. [진단 보고서](docs/counting-validation.md)와 [원본 수치](docs/counting-validation.json)를 참고하세요.

## 티처블 머신에서 열어보기

`training/parking-v2-training-source.tm`을 [티처블 머신](https://teachablemachine.withgoogle.com/train/image)의 **Open project from file** 메뉴에서 엽니다. 이 파일에는 빈자리228장·사용 중228장과 학습 설정이 들어 있습니다. **학습 전 원본 프로젝트**이므로 **Train Model**을 누른 뒤 미리보기에서 주차칸 한 칸을 잘라낸 사진으로 확인합니다. 자세한 방법은 [티처블 머신 안내](docs/teachable-machine.md)에 있습니다.

차량 수를1~10대 클래스로 다시 학습한 파일이 아닙니다. 기존 `빈자리 / 사용 중` 모델을 각 주차칸에 적용하고 결과를 합산하는 코드가 이번 웹앱 변경입니다.

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

## 검증

```bash
npm test
python -m pip install -r tools/requirements.txt
python -m unittest discover -s tests -p 'test_*.py' -v
```

집계·영역 확장 후 JavaScript50개 검사를 통과했습니다. Python 데이터 도구의 기존 검사는14개입니다. 자동 검사는 계산과 입력 검증을 확인하며 모델 정확도를 대신하지 않습니다. 실제 브라우저에서28칸 추론, 촬영 입력 경로, 영역 드래그·프로필·중복 차단·취소 후 재시도와320/390/768px 레이아웃을 확인했습니다. [브라우저 확인 기록](docs/counting-browser-qa.md)을 참고하세요. iPhone·Android 실기기 촬영·메모리·분석 시간 검증은 별도입니다.

`tools/evaluate.py`와 과거 평가 기록 도구는 A1~A4 고정4칸의 빈자리 수 평가용입니다. 새 가변 주차칸 JSON을 이 도구의 전체 차량 수 평가 입력으로 해석하지 마세요

## 데이터·외부 라이브러리 출처

PKLot: Almeida et al., “PKLot – A robust dataset for parking lot classification”, *Expert Systems with Applications*42(11),4937–4949,2015. 데이터 CC BY4.0. 공식 출처: https://web.inf.ufpr.br/vri/databases/parking-lot-database/ . 공개 전체 사진과 좌표의 미러 출처·변환 과정은 모델 출처 기록에 남겨 두었습니다.

직접 작성한 애플리케이션·학습·평가 코드는 [MIT License](LICENSE)로 제공합니다. PKLot 사진·주석은 CC BY 4.0이며, 외부 라이브러리와 사전학습 모델 자산은 각 원본의 라이선스·출처 조건을 따릅니다. 데이터 이미지·변환의 자세한 출처는 [DATA_LICENSE.md](DATA_LICENSE.md), 외부 코드와 모델의 고지는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 참고하세요.
