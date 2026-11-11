# 빈자리 v2 데이터와 실제 전체사진 평가

이 폴더는 공식 PKLot 주간 주차칸 자료를 보강하고, 실제 전체사진에서 네 칸을 분류한 평가를 제공합니다. 가중치 학습은 Teachable Machine 공식 `@teachablemachine/image@0.8.3`을 Node CPU에서 실행했습니다. 웹 학습 화면에서 학습 완료한 것으로 표현하지 않습니다.

## 데이터 구성

- `dataset-v2`: 원본/변환 SHA256 모두 고유한 756장. 학습456장(클래스별228장), 외부 검증150장, 시험150장.
- 학습의 각 클래스: Sunny100장, Cloudy100장, Rainy28장. 원래 목표100장/날씨/클래스에 비 오는 빈자리 원본이 부족하여, 확보한28장과 같은 수로 비 오는 사용 중 사진을 줄였습니다. 복제하여 수량을 채우지 않았습니다.
- 검증과 시험은 각각 날씨별·클래스별25장, 총150장입니다.
- 촬영일 단위로 엄격하게 분리했습니다(학습17일, 검증6일, 시험6일). 전체사진 시험의12월12·20·27일은 학습에 없습니다.
- 기존 v1의 외부검증일2013-01-17을 비 오는 시험일로 사용했고, v1학습일2013-01-21을 v2검증일로 옮겼습니다. v1외부검증에서 해당 날짜를 이미 평가한 이력이 있습니다. v2의50epochs/batch16/lr0.001 설정은 시험결과를 보고 조정하지 않았습니다.
- Teachable Machine 공식 내부15% 분리는 클래스별35장, 총70장을 내부검증으로 사용합니다. 실제 가중치 학습은386장입니다. 외부 검증/시험150장씩과 다릅니다.

## 실제 전체사진 시험

- `fullframe-test`: 합성 패널이 아닌1280×720 원본 전체사진30장, 고정된 네 칸120개입니다. 빈자리 수0~4칸 조건을 각각6장씩 선택했습니다.
- 같은 UFPR04의 날짜가 분리된3일(2012-12-12,20,27)입니다. 실제발생빈도 표본이 아니라 조건별 시험입니다. 인접 프레임·날짜 안의 상관관계가 있을 수 있어 독립된30개 현장이라고 해석하지 않습니다.
- `unseen-view-test`: 학습에 넣지 않은 UFPR05와 PUCPR 각5장, 총10장/40칸의 작은 별도 스트레스 시험입니다. UFPR05는 같은 UFPR 주차장의 다른 시점이며 PUCPR는 다른 주차장입니다. 실제 사용자의 주차장·야간 환경 검증을 대신하지 않습니다.
- 원본 사진은 명시한 Hugging Face 비공식 미러에서 읽었습니다. 미러는 원본 XML의 윤곽을 축에 맞춘 직사각형 bbox로 변환하고 점유 라벨을 보존합니다. 원본 XML 파일 자체는 포함하지 않습니다. 모델 예측을 보기 전에 각 시점의 첫 네 개 XML 유래 영역을 고정했습니다.
- 거듭 사용한 시험셋은 회귀 비교용 관측 결과입니다. 앞으로 모델이나 기준을 조정할 때는 새 날짜의 별도 최종시험 사진을 준비해야 합니다.

## 실행

이 폴더의 상위에 `eval-runtime/package.json`, `package-lock.json`, `tm-base-mobilenet-v2-035/`가 필요합니다. 이들은 전체 프로젝트 패키지에 포함됩니다. Node18 이상에서 상위 폴더 기준:

```sh
npm ci --prefix eval-runtime
node improvements-data/train-v2.cjs
node improvements-data/evaluate-patches.cjs
node improvements-data/evaluate-fullframes.cjs improvements-data/trained-model-v2 improvements-data/fullframe-test/v2-evaluation
node improvements-data/evaluate-fullframes.cjs improvements-data/trained-model-v2 improvements-data/unseen-view-test/v2-evaluation improvements-data/unseen-view-test
```

평가기는 현재 사이트와 SHA256이 같은 `quality.mjs`를 사용합니다. 단색·암전·백색 등 명백한 무효 입력만 거르고, 흐림·세부정보 부족은 경고합니다. 일반적인 주차장 여부 판별기는 아닙니다.

원본을 다시 수집할 경우(Pillow 설치 필요):

```sh
python improvements-data/fetch-balanced-weather.py
python improvements-data/finalize-balanced.py
python improvements-data/fetch-mirror-metadata.py
python improvements-data/fetch-fullframes.py
python improvements-data/fetch-unseen-views.py
```

`fetch-balanced-weather.py`는 공식 압축 스트림을 최대1.8GB 읽고 필요한 주차칸 사진만 저장합니다. 전체4.9GB 파일을 디스크에 저장하지 않습니다. `fetch-mirror-metadata.py`는 명시한 커밋으로 고정된 비공식 미러 메타데이터를 받습니다. 각 선택 사진·라벨·출처·해시는 manifest와 mirror-provenance에 남습니다.

`parking-v2-training-source.tm`은 웹 Teachable Machine에서 다시 학습할 수 있도록456장과 설정을 담은 소스 프로젝트입니다. 현재 저장소에 포함된 완성 추론용 모델은 `dist/models/parking/`의 model.json/metadata.json/weights.bin입니다. 이 폴더의 `trained-model-v2/`에는 모델 설명과 학습 기록을 보존합니다.

## 출처·라이선스

Almeida, P., Oliveira, L. S., Silva Jr, E., Britto Jr, A., Koerich, A. “PKLot – A robust dataset for parking lot classification”, Expert Systems with Applications42(11):4937–4949,2015. 데이터 CC BY4.0.

공식: https://web.inf.ufpr.br/vri/databases/parking-lot-database/

원본 압축파일: https://www.inf.ufpr.br/vri/databases/PKLot.tar.gz

전체사진/변환라벨 미러: https://huggingface.co/datasets/dronefreak/PKLot

고정 미러 커밋: 577e9c942e596819798d42fdc4d14d0b6646a43f

변경: 주차칸 RGB224×224 BILINEAR resize 및 JPEG93 저장. 전체사진 시험은 XML 유래 bbox 영역을 RGB224×224로 변환하고 무손실 raw RGB로 추론합니다. Pillow/JPEG 디코더와 브라우저 canvas는 경계 픽셀에서 작은 차이가 있을 수 있습니다.
