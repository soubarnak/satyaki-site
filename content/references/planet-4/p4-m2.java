public class Main {
    void forge_help(int steps) {
        for (int i = 0; i < steps; i++) {
            move();
        }
    }

    public static void main(String[] args) {
        forge_help(4);
    }
}
