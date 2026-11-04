# Netlify 배포와 접속 확인

- 사이트: https://stunning-khapse-d705ce.netlify.app/
- 운영 팀: `hyscodebase-rnweqnk` · Free
- 배포 디렉터리: `dist/`
- 빌드 명령과 환경 변수: 필요 없음

GitHub 저장소를 Netlify에 연결할 때 운영 팀을 확인합니다. 포함된 `netlify.toml`은 `dist/`만 공개하도록 설정합니다. CLI로 기존 사이트를 갱신할 때는 저장소 루트에서 실행합니다.

```bash
netlify deploy --prod --site stunning-khapse-d705ce --dir dist --no-build
```

## 2026-11-04 HTTP 429 복구

기존 사이트는 `hyscodebase`라는 Restricted Team에 귀속돼 있었습니다. 메인 화면과 정적 파일 요청 모두 Netlify 요청 ID가 포함된 HTTP 429를 반환했습니다. 같은 접속 환경에서 정상 Free 팀의 기존 사이트는 HTTP 200을 반환했고, 이 웹앱에는 별도의 요청 제한 설정이 없었습니다.

사용자 승인 후 Netlify의 공식 프로젝트 이전 기능으로 이 사이트를 정상 Free 팀 `hyscodebase-rnweqnk`으로 옮겼습니다. 사이트 ID, 주소, 배포 파일은 유지됐으며 이전 직후 같은 주소가 HTTP 200을 반환했습니다. 이전 팀이 Restricted 상태가 된 세부 사유는 API에서 확인되지 않았습니다.

복구 후 확인한 결과:

- 공개 파일 33개 모두 HTTP 200. 429, 404, 다운로드 오류 없음.
- JavaScript, Worker, 모델 JSON·metadata·weights, 모델 ZIP 등 비HTML 31개는 로컬 파일과 SHA256 일치.
- HTML 2개의 바이트 차이는 Netlify Pretty URLs의 링크·속성 변환으로 확인.
- 실제 공개 사이트에서 기본 모델 로딩과 **예제로 체험** 분석 완료 확인.
- 예제 28칸: 확인된 차량 3대, 빈자리 24칸, 확인 필요 1칸, 가능한 범위 3~4대.

![공개 사이트의 예제 분석 완료 화면](screenshots/netlify-verified-20261104.png)

예제 사진의 출처와 이용 조건은 [데이터 라이선스](../DATA_LICENSE.md)를 참고합니다. 예제 실행 확인은 다른 주차장이나 촬영 조건에서의 정확도를 보장하지 않습니다.
