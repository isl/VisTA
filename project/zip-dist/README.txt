README

1. Start platform
   Linux/Unix: 
        chmod +x start.sh
        sh start.sh
   Windows: 
        start.bat
2. Open http://localhost:10214/ in your browser
3. Login with admin/admin

!!! Change the standard login credentials after your first login !!!
This can be done in the UI using the administration interface /resource/Admin:Security. Please refer to /resource/Help:BasicSystemConfiguration for further information.

==============================
For VisTA application, 

*)update file:
	researchspace-2.1-SNAPSHOT\config\environment.prop

	by setting the correct <IP> for param
	sparqlEndpoint=http://<IP>:10214/blazegraph/sparql
	
*)visit VisTA homepage:
	http://139.91.183.8:10214/resource/forth:term-alignment


