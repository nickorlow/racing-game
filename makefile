make-tar:
	rm -rf repo.tar.gz > /dev/null && \
	tar -czvf repo.tar.gz * > /dev/null && \
	echo "Zipped project files into repo.tar.gz"

deploy: make-tar
	ssh nickorlow@media-wawa.nickorlow.com -f "cd ~/server_files/infra && docker compose stop && cd .. && rm -rf *" && \
	scp -r repo.tar.gz nickorlow@media-wawa.nickorlow.com:~/server_files && \
	ssh nickorlow@media-wawa.nickorlow.com -f "cd ~/server_files && tar xzf repo.tar.gz && cd ./infra && docker compose up -d --build" && \
	rm -rf repo.tar.gz > /dev/null

local:
	cd ./infra && docker compose stop && docker compose up -d --build
