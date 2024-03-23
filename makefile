deploy:
	ssh user@danica.nickorlow.com -f "cd ~/server_files/infra && docker compose stop && cd .. && rm -rf *" && \
	scp -r * user@danica.nickorlow.com:~/server_files && \
	ssh user@danica.nickorlow.com -f "cd ~/server_files/infra && docker compose up -d"
