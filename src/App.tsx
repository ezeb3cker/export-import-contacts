import React, { useState, useEffect, useRef } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Checkbox } from "./components/ui/checkbox";
import { ChevronsUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import { Progress } from "./components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";
import { ScrollArea } from "./components/ui/scroll-area";
import { toast } from "sonner@2.0.3";
import { Toaster } from "./components/ui/sonner";
import * as XLSX from "xlsx";

// Declaração de tipo para WlExtension
declare global {
  interface Window {
    WlExtension?: {
      getInfoChannels: () => Promise<Channel[]>;
      getInfoUser: () => Promise<{ userId: string; systemKey: string }>;
      modal: (options: any) => void;
      closeModal: (args?: any) => void;
      alert: (options: { message: string; variant: 'success' | 'error' | 'warning' }) => void;
      confirmDialog: (options: { title: string; text: string; callback: (confirm: boolean) => void }) => void;
      openPage: (options: { url: string }) => void;
      openWidget: () => void;
      load: (options: { url: string }) => void;
    };
  }
}

interface Tag {
  Id: string;
  OrganizationId: string;
  HexColor: string;
  Description: string;
}

interface Contact {
  id: string;
  name: string;
  nickName: string;
  number: string;
  email: string;
  observation: string;
  linkImage?: string;
  tags: Array<{
    Id: string;
    organizationId: string;
    hexColor: string;
    Description: string;
  }>;
}

interface Channel {
  canalId: string;
  descricao: string;
  status: string;
  type: number;
  organizationId: string;
  organizacao: string;
  identificador?: string;
  number?: string;
  ddi?: string;
  organizacaoId?: string;
  curVersion?: string;
  curOrlastServerInfo?: string;
  needsUpdate?: boolean;
  lastUpdate?: string;
}

export default function App() {
  const [mode, setMode] = useState("exportar"); // 'exportar' ou 'importar'
  const [manualToken, setManualToken] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [showManualTokenField, setShowManualTokenField] = useState(false); // Inicia sem nenhum canal selecionado
  const [format, setFormat] = useState("xlsx");
  const [channelSearchOpen, setChannelSearchOpen] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState("");
  const tagListRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    [],
  );
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [updateIfExists, setUpdateIfExists] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [importErrors, setImportErrors] = useState<Array<{
    linha: number;
    numero: string;
    nome: string;
    email: string;
    status: string;
    mensagem: string;
    codigoErro: string;
  }> | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);

  // Função para obter o token atual (canal selecionado ou token manual)
  const getCurrentToken = () => {
    if (showManualTokenField) {
      return manualToken.trim();
    }
    return selectedChannelId;
  };

  // Função para buscar canais usando WlExtension
  const fetchChannels = async () => {
    setIsLoadingChannels(true);
    try {
      // Verificar se WlExtension está disponível
      if (typeof window !== 'undefined' && window.WlExtension && window.WlExtension.getInfoChannels) {
        const channelsData = await window.WlExtension.getInfoChannels();
        setChannels(channelsData);
      } else {
        // Fallback para lista estática caso WlExtension não esteja disponível
        const staticChannels: Channel[] = [
          {
            "descricao": "WhatsApp (Cloud)",
            "status": "REGISTERED",
            "canalId": "65a9c891631763c3725cf3f6",
            "identificador": "525092970691476",
            "number": "5092970691476",
            "ddi": "52",
            "organizacao": "Grupo NFA",
            "type": 4,
            "organizationId": "65a9c7a8c03a819e147fd6b3",
            "organizacaoId": "65a9c7a8c03a819e147fd6b3",
            "curVersion": "latest",
            "curOrlastServerInfo": "general",
            "needsUpdate": false,
            "lastUpdate": "0001-01-01T00:00:00"
          }
        ];
        setChannels(staticChannels);
      }
    } catch (error) {
      console.error("Erro ao buscar canais:", error);
      toast.error("Erro ao carregar lista de canais");
      setChannels([]);
    } finally {
      setIsLoadingChannels(false);
    }
  };

  // Buscar canais ao carregar o componente
  useEffect(() => {
    fetchChannels();
  }, []);

  // Resetar seleções ao mudar de modo
  useEffect(() => {
    setSelectedChannelId("");
    setShowManualTokenField(false);
    setManualToken("");
    setSelectedTags([]);
    setTagSearchTerm("");
    setTags([]);
  }, [mode]);

  // Buscar etiquetas quando um canal for selecionado (modo exportar)
  useEffect(() => {
    const currentToken = getCurrentToken();
    if (currentToken && mode === "exportar") {
      fetchTags();
    } else {
      setTags([]);
      setSelectedTags([]);
    }
  }, [selectedChannelId, manualToken, showManualTokenField, mode]);

  // Buscar organizationId quando um canal for selecionado (apenas no modo importar)
  useEffect(() => {
    const currentToken = getCurrentToken();
    if (currentToken && mode === "importar") {
      fetchOrganizationId();
    } else {
      setOrganizationId("");
    }
  }, [selectedChannelId, manualToken, showManualTokenField, mode]);

  // Manipular mudança no seletor de canal
  const handleChannelSelection = (value: string) => {
    if (value === "manual_token") {
      setShowManualTokenField(true);
      setSelectedChannelId("");
    } else {
      setShowManualTokenField(false);
      setSelectedChannelId(value);
      setManualToken("");
    }
    setChannelSearchOpen(false);
  };

  // Obter o label do canal selecionado
  const getSelectedChannelLabel = () => {
    if (showManualTokenField) {
      return "Digitar token";
    }
    if (selectedChannelId) {
      const channel = channels.find(c => c.canalId === selectedChannelId);
      if (channel) {
        return `${channel.descricao} - ${channel.organizacao}`;
      }
    }
    return "Clique para selecionar um canal";
  };

  // Filtrar etiquetas com base no termo de pesquisa
  const filteredTags = tags.filter(tag =>
    tag.Description.toLowerCase().includes(tagSearchTerm.toLowerCase())
  );

  // Ordenar etiquetas com as selecionadas no topo
  const getSortedTags = (tagsToSort: Tag[]) => {
    return [...tagsToSort].sort((a, b) => {
      const aSelected = selectedTags.includes(a.Id);
      const bSelected = selectedTags.includes(b.Id);
      
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });
  };

  // URL API

  //  const API_URL = window.location.ancestorOrigins[0]
  // ? window.location.ancestorOrigins[0].replace("app", "api")
  // : "https://api.inovstar.com";

  const API_URL = "https://api.inovstar.com";


  console.log(API_URL);

  const fetchTags = async () => {
    const currentToken = getCurrentToken();
    if (!currentToken) return;

    console.log("Buscando etiquetas com token:", currentToken.substring(0, 10) + "...");
    setIsLoadingTags(true);
    try {
      const response = await fetch(
        `${API_URL}/core/v2/api/tags`,
        {
          method: "GET",
          headers: {
            "access-token": currentToken,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        let errorMessage = `${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.msg || errorMessage;
        } catch (e) {
          // Se não conseguir parsear o JSON, usa a mensagem padrão
        }
        throw new Error(`Erro ao buscar etiquetas: ${errorMessage}`);
      }

      const tagsData: Tag[] = await response.json();
      setTags(tagsData);
      console.log("Etiquetas carregadas:", tagsData.length);
    } catch (error) {
      console.error("Erro ao buscar etiquetas:", error);
      toast.error(
        `Erro ao buscar etiquetas: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
      );
      setTags([]);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const fetchOrganizationId = async () => {
    const currentToken = getCurrentToken();
    if (!currentToken) return;

    console.log("Buscando organization ID com token:", currentToken.substring(0, 10) + "...");
    try {
      const response = await fetch(
        `${API_URL}/core/v2/api/channel`,
        {
          method: "GET",
          headers: {
            "access-token": currentToken,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        let errorMessage = `${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.msg || errorMessage;
        } catch (e) {
          // Se não conseguir parsear o JSON, usa a mensagem padrão
        }
        throw new Error(`Erro ao buscar informações do canal: ${errorMessage}`);
      }

      const channelData = await response.json();
      setOrganizationId(channelData.organizationId);
      console.log(
        "Organization ID obtido:",
        channelData.organizationId,
      );
    } catch (error) {
      console.error("Erro ao buscar organization ID:", error);
      toast.error(
        `Erro ao buscar informações do canal: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
      );
      setOrganizationId("");
    }
  };

  const handleTagSelection = (
    tagId: string,
    checked: boolean,
  ) => {
    // Salvar a posição atual do scroll
    const currentScrollTop = tagListRef.current?.scrollTop || 0;

    if (checked) {
      setSelectedTags((prev) => [...prev, tagId]);
    } else {
      setSelectedTags((prev) =>
        prev.filter((id) => id !== tagId),
      );
    }

    // Restaurar a posição do scroll após a atualização do DOM
    setTimeout(() => {
      if (tagListRef.current) {
        tagListRef.current.scrollTop = currentScrollTop;
      }
    }, 0);
  };

  const handleExport = async () => {
    const currentToken = getCurrentToken();
    if (!currentToken) {
      toast.error("Selecione um canal ou digite um token");
      return;
    }

    setIsExporting(true);

    try {
      // Fazer requisição para a API
      const response = await fetch(
        `${API_URL}/core/v2/api/contacts`,
        {
          method: "GET",
          headers: {
            "access-token": currentToken,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Erro na API: ${response.status} ${response.statusText}`,
        );
      }

      const contacts: Contact[] = await response.json();

      // Debug: verificar estrutura dos contatos
      if (contacts.length > 0) {
        console.log("Sample contact:", contacts[0]);
        console.log("Sample contact tags:", contacts[0].tags);
      }

      // Filtrar contatos por etiquetas selecionadas se houver alguma seleção
      let filteredContacts = contacts;
      if (selectedTags.length > 0) {
        filteredContacts = contacts.filter(
          (contact) =>
            contact.tags &&
            contact.tags.some((tag) =>
              selectedTags.includes(tag.Id),
            ), // Alterado de tag.id para tag.Id
        );
      }

      console.log("Total contacts:", contacts.length);
      console.log("Selected tags:", selectedTags);
      console.log(
        "Filtered contacts:",
        filteredContacts.length,
      );

      if (
        selectedTags.length > 0 &&
        filteredContacts.length === 0
      ) {
        toast.error(
          "Nenhum contato encontrado com as etiquetas selecionadas",
        );
        setIsExporting(false);
        return;
      }

      // Processar os dados
      const processedData = filteredContacts.map((contact) => ({
        nome: contact.name || "",
        apelido: contact.nickName || "",
        numero: contact.number || "",
        email: contact.email || "",
        observacao: contact.observation || "",
        etiquetas: contact.tags
          ? contact.tags.map((tag) => tag.Description).join(",")
          : "",
      }));

      // Gerar e baixar o arquivo
      if (format === "xlsx") {
        exportToXLSX(processedData);
      } else {
        exportToCSV(processedData);
      }

      const exportMessage =
        selectedTags.length > 0
          ? `Arquivo ${format.toUpperCase()} exportado com ${filteredContacts.length} contato(s) filtrado(s)!`
          : `Arquivo ${format.toUpperCase()} exportado com ${filteredContacts.length} contato(s)!`;

      toast.success(exportMessage);
    } catch (error) {
      console.error("Erro na exportação:", error);
      toast.error(
        `Erro na exportação: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
      );
    } finally {
      setIsExporting(false);
    }
  };

  const exportToXLSX = (data: any[]) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Contatos",
    );
    XLSX.writeFile(
      workbook,
      `contatos_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  const exportToCSV = (data: any[]) => {
    const headers = [
      "nome",
      "apelido",
      "numero",
      "email",
      "observacao",
      "etiquetas",
    ];
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header] || "";
            // Escapar aspas duplas e envolver em aspas se contém vírgula, quebra de linha ou aspas
            const escapedValue = value
              .toString()
              .replace(/"/g, '""');
            return /[",\r\n]/.test(escapedValue)
              ? `"${escapedValue}"`
              : escapedValue;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `contatos_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const generateErrorReport = (
    errors: Array<{
      linha: number;
      numero: string;
      nome: string;
      email: string;
      status: string;
      mensagem: string;
      codigoErro: string;
    }>,
  ) => {
    // Preparar dados para o arquivo de erros
    const mensagensPersonalizadas = {
      "There is already a contact with this number !": "Já existe um contato com este número.",
      "Contact not found!": "Contato não encontrado.",
    };

    const errorData = errors.map((error) => ({
      Linha: error.linha,
      Número: error.numero,
      Nome: error.nome,
      "Mensagem de Erro":
        mensagensPersonalizadas[error.mensagem] ||
        error.mensagem,
    }));

    // Criar arquivo XLSX
    const worksheet = XLSX.utils.json_to_sheet(errorData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Erros de Importação",
    );

    // Baixar arquivo
    const timestamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(
      workbook,
      `erros_importacao_${timestamp}.xlsx`,
    );
  };

  const downloadErrorReport = () => {
    if (importErrors) {
      generateErrorReport(importErrors);
    }
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const fileExtension = selectedFile.name
        .split(".")
        .pop()
        ?.toLowerCase();
      if (fileExtension === "xlsx" || fileExtension === "csv") {
        setFile(selectedFile);
      } else {
        toast.error(
          "Por favor, selecione um arquivo .xlsx ou .csv",
        );
        event.target.value = "";
      }
    }
  };

  const parseFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          let jsonData: any[] = [];

          if (file.name.endsWith(".csv")) {
            // Processar CSV
            const text = data as string;
            const lines = text
              .split("\n")
              .filter((line) => line.trim());
            const headers = lines[0]
              .split(",")
              .map((h) => h.trim().replace(/"/g, ""));

            for (let i = 1; i < lines.length; i++) {
              const values = lines[i]
                .split(",")
                .map((v) => v.trim().replace(/"/g, ""));
              const row: any = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || "";
              });
              jsonData.push(row);
            }
          } else {
            // Processar XLSX
            const workbook = XLSX.read(data, {
              type: "binary",
            });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            jsonData = XLSX.utils.sheet_to_json(worksheet);
          }

          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };

      if (file.name.endsWith(".csv")) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    });
  };

  // Sistema de Rate Limiting para a API
  class RateLimiter {
    private requestTimes: number[] = [];
    private readonly maxRequestsPerSecond = 50;
    private readonly maxRequestsPerMinute = 2500;
    private readonly secondWindow = 1000; // 1 segundo em ms
    private readonly minuteWindow = 60000; // 1 minuto em ms

    async waitForNextRequest(): Promise<void> {
      const now = Date.now();
      
      // Remove requisições antigas da janela de tempo
      this.requestTimes = this.requestTimes.filter(
        time => now - time < this.minuteWindow
      );

      // Conta requisições no último segundo
      const recentRequests = this.requestTimes.filter(
        time => now - time < this.secondWindow
      );

      // Se atingiu o limite por segundo, aguarda
      if (recentRequests.length >= this.maxRequestsPerSecond) {
        const oldestRecentRequest = Math.min(...recentRequests);
        const waitTime = this.secondWindow - (now - oldestRecentRequest) + 10; // +10ms de margem
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // Se atingiu o limite por minuto, aguarda
      if (this.requestTimes.length >= this.maxRequestsPerMinute) {
        const oldestRequest = Math.min(...this.requestTimes);
        const waitTime = this.minuteWindow - (now - oldestRequest) + 100; // +100ms de margem
        if (waitTime > 0) {
          console.log(`Rate limit atingido. Aguardando ${Math.round(waitTime/1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // Registra a nova requisição
      this.requestTimes.push(Date.now());
    }

    getStats() {
      const now = Date.now();
      const recentRequests = this.requestTimes.filter(
        time => now - time < this.secondWindow
      );
      const minuteRequests = this.requestTimes.filter(
        time => now - time < this.minuteWindow
      );
      
      return {
        requestsLastSecond: recentRequests.length,
        requestsLastMinute: minuteRequests.length,
        maxPerSecond: this.maxRequestsPerSecond,
        maxPerMinute: this.maxRequestsPerMinute
      };
    }
  }

  const handleImport = async () => {
    const currentToken = getCurrentToken();
    if (!currentToken) {
      toast.error("Selecione um canal ou digite um token");
      return;
    }

    if (!file) {
      toast.error(
        "Por favor, selecione um arquivo para importar",
      );
      return;
    }

    if (!organizationId) {
      toast.error(
        "Organization ID não encontrado. Verifique o token do canal.",
      );
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportErrors(null);

    // Inicializar rate limiter
    const rateLimiter = new RateLimiter();

    try {
      const data = await parseFile(file);
      console.log("Dados do arquivo:", data);
      console.log(`Iniciando importação de ${data.length} contatos com rate limiting...`);

      let successCount = 0;
      let errorCount = 0;
      const totalContacts = data.length;
      const errorDetails: Array<{
        linha: number;
        numero: string;
        nome: string;
        email: string;
        status: string;
        mensagem: string;
        codigoErro: string;
      }> = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        try {
          // Aplicar rate limiting antes de cada requisição
          await rateLimiter.waitForNextRequest();
          
          // Log do progresso do rate limiting a cada 100 contatos
          if (i % 100 === 0 && i > 0) {
            const stats = rateLimiter.getStats();
            console.log(`Progresso: ${i}/${totalContacts} - Rate: ${stats.requestsLastSecond}/s, ${stats.requestsLastMinute}/min`);
          }

          // Processar etiquetas
          const tagsArray: Array<{
            description: string;
            organizationId: string;
            hexColor: string;
          }> = [];
          if (row.etiquetas || row.Etiquetas) {
            const tagDescriptions = (
              row.etiquetas || row.Etiquetas
            )
              .split(",")
              .map((tag: string) => tag.trim());
            for (const tagDescription of tagDescriptions) {
              if (tagDescription) {
                tagsArray.push({
                  description: tagDescription,
                  organizationId: organizationId,
                  hexColor: "#192D3E",
                });
              }
            }
          }

          const contactData = {
            number: row.numero || row.Numero || "",
            nickName: row.apelido || row.Apelido || "",
            email: row.email || row.Email || "",
            observation: row.observacao || row.Observacao || "",
            tags: tagsArray,
            updateIfExists: updateIfExists,
          };

          const response = await fetch(
            `${API_URL}/core/v2/api/contacts`,
            {
              method: "POST",
              headers: {
                "access-token": currentToken,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(contactData),
            },
          );

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
            try {
              const errorResponse = await response.json();
              errorDetails.push({
                linha: i + 2, // +2 porque linha 1 é header e índice começa em 0
                numero:
                  row.numero || row.Numero || "Não informado",
                nome: row.nome || row.Nome || "Não informado",
                email:
                  row.email || row.Email || "Não informado",
                status:
                  errorResponse.status ||
                  response.status.toString(),
                mensagem:
                  errorResponse.msg || response.statusText,
                codigoErro: errorResponse.errorCode || "N/A",
              });
            } catch (parseError) {
              // Se não conseguir fazer parse do JSON de erro, usar informações básicas
              errorDetails.push({
                linha: i + 2,
                numero:
                  row.numero || row.Numero || "Não informado",
                nome: row.nome || row.Nome || "Não informado",
                email:
                  row.email || row.Email || "Não informado",
                status: response.status.toString(),
                mensagem: response.statusText,
                codigoErro: "N/A",
              });
            }
            console.error(
              `Erro ao importar contato ${row.numero || "sem número"}:`,
              response.status,
              response.statusText,
            );
          }
        } catch (contactError) {
          errorCount++;
          errorDetails.push({
            linha: i + 2,
            numero: row.numero || row.Numero || "Não informado",
            nome: row.nome || row.Nome || "Não informado",
            email: row.email || row.Email || "Não informado",
            status: "Erro de processamento",
            mensagem:
              contactError instanceof Error
                ? contactError.message
                : "Erro desconhecido ao processar contato",
            codigoErro: "N/A",
          });
          console.error(
            `Erro ao processar contato ${row.numero || "sem número"}:`,
            contactError,
          );
        }

        // Atualizar progresso
        const progress = Math.round(
          ((i + 1) / totalContacts) * 100,
        );
        setImportProgress(progress);
      }

      // Log final das estatísticas
      const finalStats = rateLimiter.getStats();
      console.log(`Importação concluída. Rate final: ${finalStats.requestsLastSecond}/s, ${finalStats.requestsLastMinute}/min`);

      if (successCount > 0) {
        toast.success(
          `${successCount} contato(s) importado(s) com sucesso!`,
        );
      }

      if (errorCount > 0) {
        toast.error(
          `${errorCount} contato(s) falharam na importação.`,
        );

        // Armazenar erros para download posterior
        setImportErrors(errorDetails);
      }

      // Limpar arquivo após importação
      setFile(null);
      const fileInput = document.getElementById(
        "file-input",
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Erro na importação:", error);
      toast.error(
        `Erro na importação: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
      );
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-background p-2">
      <div className="max-w-md mx-auto space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-center">
              {mode === "exportar"
                ? "Exportar Contatos"
                : "Importar Contatos"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Seletor de Modo */}
            <div className="space-y-2">
              <Label>O que você deseja fazer?</Label>
              <div className="relative inline-flex h-9 w-full bg-muted rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setMode("exportar")}
                  disabled={isExporting || isImporting}
                  className={`flex-1 text-center transition-all duration-200 rounded-md ${
                    mode === "exportar"
                      ? "bg-background shadow-sm"
                      : "hover:bg-background/50"
                  } ${isExporting || isImporting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  Exportar
                </button>
                <button
                  type="button"
                  onClick={() => setMode("importar")}
                  disabled={isExporting || isImporting}
                  className={`flex-1 text-center transition-all duration-200 rounded-md ${
                    mode === "importar"
                      ? "bg-background shadow-sm"
                      : "hover:bg-background/50"
                  } ${isExporting || isImporting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  Importar
                </button>
              </div>
            </div>

            {/* Seleção de Canal */}
            <div className="space-y-2">
              <div className="space-y-2">
                <Label>
                  Selecione o canal
                </Label>
                <TooltipProvider>
                  <Popover open={channelSearchOpen} onOpenChange={setChannelSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        type="button"
                        aria-expanded={channelSearchOpen}
                        className="w-full justify-between h-9"
                        disabled={isExporting || isImporting || isLoadingChannels}
                        title={isLoadingChannels ? "Carregando canais..." : getSelectedChannelLabel()}
                      >
                        <span className="truncate">
                          {isLoadingChannels ? "Carregando canais..." : getSelectedChannelLabel()}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 max-h-[300px] overflow-auto" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar canal ou organização..." />
                        <CommandList>
                          <CommandEmpty>
                            {isLoadingChannels ? "Carregando canais..." : "Nenhum canal encontrado."}
                          </CommandEmpty>
                          <CommandGroup>
                            {channels
                              .filter(channel => channel.type !== 2 && channel.type !== 6)
                              .map((channel) => {
                                const isActive = channel.status === 'REGISTERED' || channel.status === 'CONNECTED';
                                const statusText = isActive ? 'Conectado' : 'Desconectado';
                                const channelLabel = `${channel.descricao} - ${channel.organizacao}`;
                                return (
                                  <CommandItem
                                    key={channel.canalId}
                                    value={`${channel.descricao} ${channel.organizacao}`}
                                    onSelect={() => handleChannelSelection(channel.canalId)}
                                    disabled={isLoadingChannels}
                                  >
                                    <div className="flex items-center gap-2 w-full">
                                      <Tooltip>
                                        <TooltipTrigger className="cursor-help">
                                          <div
                                            className={`w-2 h-2 rounded-full ${
                                              isActive ? 'bg-green-500' : 'bg-red-500'
                                            }`}
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{statusText}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="flex-1 truncate">
                                            {channel.descricao} <span className="text-muted-foreground">- {channel.organizacao}</span>
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{channelLabel}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            <CommandItem
                              value="digitar token manual"
                              onSelect={() => handleChannelSelection("manual_token")}
                              disabled={isLoadingChannels}
                            >
                              Digitar token
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </TooltipProvider>
              </div>

              {/* Campo Token Manual */}
              {showManualTokenField && (
                <div className="space-y-2">
                  <Label htmlFor="manual-token">
                    Token de acesso
                  </Label>
                  <Input
                    id="manual-token"
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Cole aqui o seu token de acesso"
                    disabled={isExporting || isImporting}
                    className="bg-input-background focus-visible:bg-input-background"
                  />
                </div>
              )}
            </div>

            {/* Conteúdo específico do modo */}
            {mode === "exportar" ? (
              <>
                {/* Modo Exportar */}
                {/* Seletor de Etiquetas */}
                {getCurrentToken() && (
                  <div className="space-y-2">
                    <Label>
                      Filtrar por etiquetas (opcional)
                    </Label>
                    {isLoadingTags ? (
                      <div className="text-muted-foreground">
                        Carregando etiquetas...
                      </div>
                    ) : tags.length > 0 ? (
                      <div className="border rounded-md p-2 space-y-2">
                        <Input
                          type="text"
                          placeholder="Buscar etiqueta..."
                          value={tagSearchTerm}
                          onChange={(e) => setTagSearchTerm(e.target.value)}
                          disabled={isExporting}
                          className="bg-input-background focus-visible:bg-input-background"
                        />
                        <div ref={tagListRef} className="max-h-32 overflow-y-auto space-y-1.5">
                          {filteredTags.length > 0 ? (
                            getSortedTags(filteredTags).map((tag) => (
                              <div
                                key={tag.Id}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={`tag-${tag.Id}`}
                                  checked={selectedTags.includes(
                                    tag.Id,
                                  )}
                                  onCheckedChange={(checked) =>
                                    handleTagSelection(
                                      tag.Id,
                                      checked as boolean,
                                    )
                                  }
                                  disabled={isExporting}
                                />
                                <Label
                                  htmlFor={`tag-${tag.Id}`}
                                  className="cursor-pointer flex-1"
                                >
                                  {tag.Description}
                                </Label>
                              </div>
                            ))
                          ) : (
                            <div className="text-muted-foreground">
                              Nenhuma etiqueta encontrada
                            </div>
                          )}
                        </div>
                        {selectedTags.length > 0 && (
                          <div className="text-muted-foreground pt-1 border-t">
                            {selectedTags.length} etiqueta(s)
                            selecionada(s)
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        Nenhuma etiqueta encontrada
                      </div>
                    )}
                  </div>
                )}

                {/* Seletor de Formato */}
                <div className="space-y-2">
                  <Label>Escolha o formato do arquivo</Label>
                  <div className="relative inline-flex h-9 w-full bg-muted rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setFormat("csv")}
                      disabled={isExporting}
                      className={`flex-1 text-center transition-all duration-200 rounded-md ${
                        format === "csv"
                          ? "bg-background shadow-sm"
                          : "hover:bg-background/50"
                      } ${isExporting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormat("xlsx")}
                      disabled={isExporting}
                      className={`flex-1 text-center transition-all duration-200 rounded-md ${
                        format === "xlsx"
                          ? "bg-background shadow-sm"
                          : "hover:bg-background/50"
                      } ${isExporting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      XLSX
                    </button>
                  </div>
                </div>

                {/* Botão Exportar */}
                <Button
                  onClick={handleExport}
                  disabled={!getCurrentToken() || isExporting}
                  className="w-full"
                  style={{
                    backgroundColor: "#192D3E",
                    borderColor: "#192D3E",
                  }}
                >
                  {isExporting
                    ? "Exportando..."
                    : "Exportar contatos"}
                </Button>
              </>
            ) : (
              <>
                {/* Modo Importar */}
                {/* Toggle Atualizar Contatos Existentes */}
                <div className="space-y-2">
                  <Label>Atualizar contatos existentes?</Label>
                  <div className="relative inline-flex h-9 w-full bg-muted rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setUpdateIfExists(false)}
                      disabled={isImporting}
                      className={`flex-1 text-center transition-all duration-200 rounded-md ${
                        !updateIfExists
                          ? "bg-background shadow-sm"
                          : "hover:bg-background/50"
                      } ${isImporting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      Não
                    </button>
                    <button
                      type="button"
                      onClick={() => setUpdateIfExists(true)}
                      disabled={isImporting}
                      className={`flex-1 text-center transition-all duration-200 rounded-md ${
                        updateIfExists
                          ? "bg-background shadow-sm"
                          : "hover:bg-background/50"
                      } ${isImporting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      Sim
                    </button>
                  </div>
                </div>

                {/* Campo para Arquivo */}
                <div className="space-y-2">
                  <Label htmlFor="file-input">
                    Envie sua lista de contatos (XLSX ou CSV)
                  </Label>
                  <Input
                    id="file-input"
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={handleFileChange}
                    disabled={isImporting}
                    className="cursor-pointer"
                  />
                  {file && (
                    <div className="text-muted-foreground truncate">
                      Arquivo selecionado: {file.name}
                    </div>
                  )}
                </div>

                {/* Barra de Progresso */}
                {isImporting && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label>Progresso da importação</Label>
                      <span className="text-muted-foreground">
                        {importProgress}%
                      </span>
                    </div>
                    <Progress
                      value={importProgress}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Mensagem de erro e link para download */}
                {importErrors && importErrors.length > 0 && (
                  <div className="text-center">
                    <button
                      onClick={downloadErrorReport}
                      className="text-destructive hover:text-destructive/80 underline cursor-pointer"
                    >
                      Alguns contatos não foram importados, clique aqui para baixá-los
                    </button>
                  </div>
                )}

                {/* Botão Importar */}
                <Button
                  onClick={handleImport}
                  disabled={
                    !getCurrentToken() ||
                    !file ||
                    !organizationId ||
                    isImporting
                  }
                  className="w-full"
                  style={{
                    backgroundColor: "#192D3E",
                    borderColor: "#192D3E",
                  }}
                >
                  {isImporting
                    ? "Importando..."
                    : "Importar Contatos"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Toaster />
    </div>
  );
}